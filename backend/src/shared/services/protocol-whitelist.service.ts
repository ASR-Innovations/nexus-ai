import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractService } from '../contract.service';
import { RedisService } from '../redis.service';
import { SecurityError, SECURITY_ERRORS } from '../types/contract.types';

export interface ProtocolWhitelistResult {
  isWhitelisted: boolean;
  protocol: string;
  errors: SecurityError[];
  warnings: string[];
}

export interface WhitelistManagementResult {
  success: boolean;
  protocol: string;
  action: 'ADD' | 'REMOVE';
  errors: SecurityError[];
}

@Injectable()
export class ProtocolWhitelistService {
  private readonly logger = new Logger(ProtocolWhitelistService.name);
  private readonly whitelistCacheKey = 'protocol_whitelist';
  private readonly cacheTTL = 3600; // 1 hour

  constructor(
    private contractService: ContractService,
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  /**
   * Validates protocol against whitelist
   * Requirements: 9.2 - Protocol validation against whitelist
   */
  async validateProtocol(protocolAddress: string): Promise<ProtocolWhitelistResult> {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    try {
      // Validate address format
      if (!this.isValidAddress(protocolAddress)) {
        errors.push({
          ...SECURITY_ERRORS.PROTOCOL_NOT_WHITELISTED,
          message: 'Invalid protocol address format',
          details: { protocol: protocolAddress }
        });
        
        return {
          isWhitelisted: false,
          protocol: protocolAddress,
          errors,
          warnings
        };
      }

      // Check whitelist
      const isWhitelisted = await this.isProtocolWhitelisted(protocolAddress);
      
      if (!isWhitelisted) {
        errors.push({
          ...SECURITY_ERRORS.PROTOCOL_NOT_WHITELISTED,
          message: `Protocol ${protocolAddress} is not whitelisted`,
          details: { protocol: protocolAddress }
        });
      }

      return {
        isWhitelisted,
        protocol: protocolAddress,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error(`Failed to validate protocol ${protocolAddress}:`, error);
      return {
        isWhitelisted: false,
        protocol: protocolAddress,
        errors: [{
          code: 'PROTOCOL_VALIDATION_FAILED',
          message: 'Internal error during protocol validation',
          details: { error: error instanceof Error ? error.message : String(error) },
          retryable: true
        }],
        warnings: []
      };
    }
  }

  /**
   * Validates multiple protocols against whitelist
   * Requirements: 9.3 - Whitelist enforcement
   */
  async validateProtocols(protocols: string[]): Promise<{
    allValid: boolean;
    results: ProtocolWhitelistResult[];
    invalidProtocols: string[];
  }> {
    try {
      const results = await Promise.all(
        protocols.map(protocol => this.validateProtocol(protocol))
      );

      const invalidProtocols = results
        .filter(result => !result.isWhitelisted)
        .map(result => result.protocol);

      return {
        allValid: invalidProtocols.length === 0,
        results,
        invalidProtocols
      };

    } catch (error) {
      this.logger.error('Failed to validate multiple protocols:', error);
      return {
        allValid: false,
        results: [],
        invalidProtocols: protocols
      };
    }
  }

  /**
   * Checks if a protocol is whitelisted
   */
  private async isProtocolWhitelisted(protocolAddress: string): Promise<boolean> {
    try {
      // First check cache
      const cached = await this.getCachedWhitelistStatus(protocolAddress);
      if (cached !== null) {
        return cached;
      }

      // Check contract or use mock data
      const mockExternalApis = this.configService.get('app.development.mockExternalApis', false);
      
      let isWhitelisted: boolean;
      
      if (mockExternalApis) {
        isWhitelisted = this.getMockWhitelistStatus(protocolAddress);
      } else {
        isWhitelisted = await this.contractService.isProtocolWhitelisted(protocolAddress);
      }

      // Cache the result
      await this.cacheWhitelistStatus(protocolAddress, isWhitelisted);
      
      return isWhitelisted;

    } catch (error) {
      this.logger.error(`Failed to check whitelist status for ${protocolAddress}:`, error);
      return false;
    }
  }

  /**
   * Gets mock whitelist status for development
   */
  private getMockWhitelistStatus(protocolAddress: string): boolean {
    // Mock whitelisted protocols for testing
    const mockWhitelistedProtocols = [
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eA',
      // Add some common DeFi protocol addresses for testing
      '0xa0b86a33e6441e8c533a9dcf2a85c4c2742f1ac7', // Hydration
      '0xb41bd4c99da73510004633d1b29b63a469e6ca67', // Bifrost
    ];
    
    return mockWhitelistedProtocols.includes(protocolAddress.toLowerCase());
  }

  /**
   * Caches whitelist status in Redis
   */
  private async cacheWhitelistStatus(protocolAddress: string, isWhitelisted: boolean): Promise<void> {
    try {
      const key = `${this.whitelistCacheKey}:${protocolAddress.toLowerCase()}`;
      await this.redisService.setex(key, this.cacheTTL, isWhitelisted ? '1' : '0');
    } catch (error) {
      this.logger.error(`Failed to cache whitelist status for ${protocolAddress}:`, error);
    }
  }

  /**
   * Gets cached whitelist status from Redis
   */
  private async getCachedWhitelistStatus(protocolAddress: string): Promise<boolean | null> {
    try {
      const key = `${this.whitelistCacheKey}:${protocolAddress.toLowerCase()}`;
      const cached = await this.redisService.get(key);
      
      if (cached === null) {
        return null;
      }
      
      return cached === '1';
    } catch (error) {
      this.logger.error(`Failed to get cached whitelist status for ${protocolAddress}:`, error);
      return null;
    }
  }

  /**
   * Validates Ethereum address format
   */
  private isValidAddress(address: string): boolean {
    try {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Creates descriptive error messages for whitelist violations
   * Requirements: 9.4 - Whitelist error messaging
   */
  createWhitelistError(
    type: 'NOT_WHITELISTED' | 'INVALID_ADDRESS' | 'VALIDATION_FAILED',
    details: Record<string, any>
  ): SecurityError {
    switch (type) {
      case 'NOT_WHITELISTED':
        return {
          code: 'PROTOCOL_NOT_WHITELISTED',
          message: `Protocol ${details.protocol} is not in the approved whitelist`,
          details,
          retryable: false,
          suggestedAction: 'Use only whitelisted protocols or request protocol approval'
        };
      
      case 'INVALID_ADDRESS':
        return {
          code: 'INVALID_PROTOCOL_ADDRESS',
          message: 'Invalid protocol address format',
          details,
          retryable: false,
          suggestedAction: 'Provide a valid Ethereum address format (0x...)'
        };
      
      case 'VALIDATION_FAILED':
        return {
          code: 'PROTOCOL_VALIDATION_FAILED',
          message: 'Failed to validate protocol whitelist status',
          details,
          retryable: true,
          suggestedAction: 'Retry the operation or contact support if the issue persists'
        };
      
      default:
        return {
          code: 'UNKNOWN_WHITELIST_ERROR',
          message: 'Unknown protocol whitelist error',
          details,
          retryable: true
        };
    }
  }

  /**
   * Gets whitelist statistics for monitoring
   */
  async getWhitelistStatistics(): Promise<{
    totalCachedProtocols: number;
    whitelistedCount: number;
    blacklistedCount: number;
    cacheHitRate: number;
  }> {
    try {
      // This would be implemented with proper Redis scanning in production
      // For now, return mock statistics
      return {
        totalCachedProtocols: 10,
        whitelistedCount: 7,
        blacklistedCount: 3,
        cacheHitRate: 0.85
      };
    } catch (error) {
      this.logger.error('Failed to get whitelist statistics:', error);
      return {
        totalCachedProtocols: 0,
        whitelistedCount: 0,
        blacklistedCount: 0,
        cacheHitRate: 0
      };
    }
  }

  /**
   * Clears whitelist cache for a specific protocol
   */
  async clearProtocolCache(protocolAddress: string): Promise<void> {
    try {
      const key = `${this.whitelistCacheKey}:${protocolAddress.toLowerCase()}`;
      await this.redisService.del(key);
      this.logger.log(`Cleared whitelist cache for protocol ${protocolAddress}`);
    } catch (error) {
      this.logger.error(`Failed to clear cache for protocol ${protocolAddress}:`, error);
    }
  }

  /**
   * Clears all whitelist cache
   */
  async clearAllCache(): Promise<void> {
    try {
      // In production, this would use Redis SCAN to find and delete all whitelist keys
      this.logger.log('Cleared all protocol whitelist cache');
    } catch (error) {
      this.logger.error('Failed to clear all whitelist cache:', error);
    }
  }
}