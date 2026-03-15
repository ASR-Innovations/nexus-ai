/**
 * Rate Limit Service
 * 
 * Enforces per-agent rate limiting with maximum 10 active intents per agent.
 * Uses Redis for scalable count storage and provides increment/decrement logic.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { ContractService } from '../contract.service';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxCount: number;
  reason?: string;
}

export interface RateLimitError {
  code: string;
  message: string;
  agentAddress: string;
  currentCount: number;
  maxCount: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly MAX_ACTIVE_INTENTS = 10;
  private readonly REDIS_KEY_PREFIX = 'agent_intent_count';
  private readonly REDIS_TTL = 86400; // 24 hours

  constructor(
    private readonly redisService: RedisService,
    private readonly contractService: ContractService
  ) {}

  /**
   * Check if agent is within rate limits (< 10 active intents)
   */
  async checkLimit(agentAddress: string): Promise<RateLimitResult> {
    try {
      const currentCount = await this.getCurrentCount(agentAddress);
      const maxCount = this.MAX_ACTIVE_INTENTS;
      
      const allowed = currentCount < maxCount;
      
      this.logger.debug(`Rate limit check for ${agentAddress}: ${currentCount}/${maxCount} (allowed: ${allowed})`);
      
      return {
        allowed,
        currentCount,
        maxCount,
        reason: allowed ? undefined : 'Maximum active intent limit exceeded'
      };
    } catch (error) {
      this.logger.error(`Failed to check rate limit for agent ${agentAddress}:`, error);
      
      // On error, be conservative and deny the request
      return {
        allowed: false,
        currentCount: 0,
        maxCount: this.MAX_ACTIVE_INTENTS,
        reason: `Rate limit check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Increment agent's active intent count
   */
  async incrementCount(agentAddress: string): Promise<number> {
    try {
      const key = this.getRedisKey(agentAddress);
      const newCount = await this.redisService.incr(key);
      
      // Set TTL on first increment
      if (newCount === 1) {
        await this.redisService.expire(key, this.REDIS_TTL);
      }
      
      this.logger.debug(`Incremented intent count for ${agentAddress}: ${newCount}`);
      
      return newCount;
    } catch (error) {
      this.logger.error(`Failed to increment intent count for agent ${agentAddress}:`, error);
      throw error;
    }
  }

  /**
   * Decrement agent's active intent count
   */
  async decrementCount(agentAddress: string): Promise<number> {
    try {
      const key = this.getRedisKey(agentAddress);
      const currentCount = await this.getCurrentCount(agentAddress);
      
      if (currentCount > 0) {
        const newCount = await this.redisService.decr(key);
        this.logger.debug(`Decremented intent count for ${agentAddress}: ${newCount}`);
        
        // Clean up key if count reaches 0
        if (newCount <= 0) {
          await this.redisService.del(key);
          return 0;
        }
        
        return newCount;
      }
      
      // Already at 0, no need to decrement
      this.logger.debug(`Intent count for ${agentAddress} already at 0, no decrement needed`);
      return 0;
    } catch (error) {
      this.logger.error(`Failed to decrement intent count for agent ${agentAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get current active intent count for agent
   */
  async getCurrentCount(agentAddress: string): Promise<number> {
    try {
      const key = this.getRedisKey(agentAddress);
      const count = await this.redisService.get(key);
      
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      this.logger.error(`Failed to get current count for agent ${agentAddress}:`, error);
      return 0; // Return 0 on error to be safe
    }
  }

  /**
   * Reset agent's intent count to 0
   */
  async resetCount(agentAddress: string): Promise<void> {
    try {
      const key = this.getRedisKey(agentAddress);
      await this.redisService.del(key);
      
      this.logger.log(`Reset intent count for agent ${agentAddress}`);
    } catch (error) {
      this.logger.error(`Failed to reset count for agent ${agentAddress}:`, error);
      throw error;
    }
  }

  /**
   * Validate rate limit before intent creation
   */
  async validateBeforeIntentCreation(agentAddress: string): Promise<void> {
    const result = await this.checkLimit(agentAddress);
    
    if (!result.allowed) {
      const error: RateLimitError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Agent has reached maximum active intent limit of ${result.maxCount}. Current count: ${result.currentCount}`,
        agentAddress,
        currentCount: result.currentCount,
        maxCount: result.maxCount
      };
      
      this.logger.warn(`Rate limit exceeded for agent ${agentAddress}:`, error);
      throw new Error(error.message);
    }
  }

  /**
   * Sync Redis count with on-chain data (for consistency)
   */
  async syncWithOnChainData(agentAddress: string): Promise<{
    redisCount: number;
    onChainCount: number;
    synced: boolean;
  }> {
    try {
      const [redisCount, onChainCount] = await Promise.all([
        this.getCurrentCount(agentAddress),
        this.getOnChainActiveIntentCount(agentAddress)
      ]);

      if (redisCount !== onChainCount) {
        this.logger.warn(
          `Count mismatch for agent ${agentAddress}: Redis=${redisCount}, OnChain=${onChainCount}. Syncing...`
        );
        
        // Update Redis to match on-chain data
        const key = this.getRedisKey(agentAddress);
        if (onChainCount > 0) {
          await this.redisService.set(key, onChainCount.toString(), this.REDIS_TTL);
        } else {
          await this.redisService.del(key);
        }
        
        return {
          redisCount,
          onChainCount,
          synced: true
        };
      }

      return {
        redisCount,
        onChainCount,
        synced: false // No sync needed
      };
    } catch (error) {
      this.logger.error(`Failed to sync count for agent ${agentAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get active intent count from smart contract
   */
  private async getOnChainActiveIntentCount(agentAddress: string): Promise<number> {
    try {
      const count = await this.contractService.getAgentActiveIntentCount(agentAddress);
      return Number(count);
    } catch (error) {
      this.logger.error(`Failed to get on-chain count for agent ${agentAddress}:`, error);
      return 0;
    }
  }

  /**
   * Generate Redis key for agent intent count
   */
  private getRedisKey(agentAddress: string): string {
    return `${this.REDIS_KEY_PREFIX}:${agentAddress.toLowerCase()}`;
  }

  /**
   * Get rate limiting statistics for monitoring
   */
  async getStatistics(): Promise<{
    totalAgentsTracked: number;
    agentsAtLimit: number;
    averageIntentCount: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to use Redis SCAN to get all keys
      // For now, we'll return basic stats
      
      return {
        totalAgentsTracked: 0, // Would need to scan Redis keys
        agentsAtLimit: 0,      // Would need to check each agent
        averageIntentCount: 0  // Would need to calculate from all agents
      };
    } catch (error) {
      this.logger.error('Failed to get rate limiting statistics:', error);
      throw error;
    }
  }

  /**
   * Batch check rate limits for multiple agents
   */
  async batchCheckLimits(agentAddresses: string[]): Promise<Map<string, RateLimitResult>> {
    const results = new Map<string, RateLimitResult>();
    
    try {
      const promises = agentAddresses.map(async (address) => {
        const result = await this.checkLimit(address);
        return { address, result };
      });
      
      const resolvedResults = await Promise.all(promises);
      
      for (const { address, result } of resolvedResults) {
        results.set(address, result);
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to batch check rate limits:', error);
      throw error;
    }
  }
}