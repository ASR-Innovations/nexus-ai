import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache.service';
import { createHash } from 'crypto';

export interface DeduplicationOptions {
  ttl?: number;
  keyPrefix?: string;
}

@Injectable()
export class RequestDeduplicationService {
  private readonly logger = new Logger(RequestDeduplicationService.name);
  private readonly pendingRequests = new Map<string, Promise<any>>();

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Execute a function with request deduplication
   * If the same request is already in progress, return the existing promise
   */
  async deduplicate<T>(
    key: string,
    executeFn: () => Promise<T>,
    options: DeduplicationOptions = {}
  ): Promise<T> {
    const deduplicationKey = this.generateKey(key, options.keyPrefix);
    
    try {
      // Check if there's already a pending request
      const pendingRequest = this.pendingRequests.get(deduplicationKey);
      if (pendingRequest) {
        this.logger.debug(`Request deduplication hit for key: ${deduplicationKey}`);
        return await pendingRequest;
      }

      // Check Redis for distributed deduplication
      const lockKey = `lock:${deduplicationKey}`;
      const lockAcquired = await this.acquireLock(lockKey, options.ttl || 30);
      
      if (!lockAcquired) {
        // Another instance is processing this request, wait and retry
        this.logger.debug(`Distributed deduplication hit for key: ${deduplicationKey}`);
        await this.waitForCompletion(deduplicationKey, options.ttl || 30);
        
        // Try to get cached result
        const cachedResult = await this.cacheService.get<T>(deduplicationKey);
        if (cachedResult !== null) {
          return cachedResult;
        }
        
        // If no cached result, execute the function
        this.logger.debug(`No cached result found, executing function for key: ${deduplicationKey}`);
      }

      // Execute the function
      const executePromise = this.executeWithCleanup(
        deduplicationKey,
        lockKey,
        executeFn,
        options
      );
      
      this.pendingRequests.set(deduplicationKey, executePromise);
      
      return await executePromise;
    } catch (error) {
      this.logger.error(`Request deduplication error for key ${deduplicationKey}:`, error);
      throw error;
    }
  }

  /**
   * Execute function with proper cleanup
   */
  private async executeWithCleanup<T>(
    deduplicationKey: string,
    lockKey: string,
    executeFn: () => Promise<T>,
    options: DeduplicationOptions
  ): Promise<T> {
    try {
      const result = await executeFn();
      
      // Cache the result for other instances
      await this.cacheService.set(deduplicationKey, result, { 
        ttl: options.ttl || 30 
      });
      
      return result;
    } finally {
      // Clean up
      this.pendingRequests.delete(deduplicationKey);
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Acquire distributed lock using Redis SETNX
   */
  private async acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    try {
      const lockValue = Date.now().toString();
      const acquired = await this.cacheService.set(lockKey, lockValue, { ttl: ttlSeconds });
      
      if (acquired) {
        this.logger.debug(`Lock acquired: ${lockKey}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to acquire lock ${lockKey}:`, error);
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.cacheService.delete(lockKey);
      this.logger.debug(`Lock released: ${lockKey}`);
    } catch (error) {
      this.logger.error(`Failed to release lock ${lockKey}:`, error);
    }
  }

  /**
   * Wait for another instance to complete the request
   */
  private async waitForCompletion(key: string, maxWaitSeconds: number): Promise<void> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    
    while (Date.now() - startTime < maxWaitMs) {
      // Check if result is available
      const result = await this.cacheService.get(key);
      if (result !== null) {
        return;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.logger.warn(`Timeout waiting for completion of key: ${key}`);
  }

  /**
   * Generate deduplication key
   */
  private generateKey(key: string, prefix?: string): string {
    const hash = createHash('sha256').update(key).digest('hex').substring(0, 16);
    return prefix ? `${prefix}:${hash}` : `dedup:${hash}`;
  }

  /**
   * Clear all pending requests (useful for testing or shutdown)
   */
  clearPendingRequests(): void {
    this.pendingRequests.clear();
    this.logger.log('Cleared all pending requests');
  }

  /**
   * Get statistics about pending requests
   */
  getStats(): { pendingCount: number; pendingKeys: string[] } {
    return {
      pendingCount: this.pendingRequests.size,
      pendingKeys: Array.from(this.pendingRequests.keys()),
    };
  }
}