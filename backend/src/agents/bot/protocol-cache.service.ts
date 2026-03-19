/**
 * Protocol Cache Service
 * Implements caching for frequently accessed protocol data
 * Validates: Requirements 8.5
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheMetrics {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
}

@Injectable()
export class ProtocolCacheService {
  private readonly logger = new Logger(ProtocolCacheService.name);

  // Cache storage
  private cache: Map<string, CacheEntry<any>> = new Map();

  // Metrics
  private totalHits = 0;
  private totalMisses = 0;

  // Configuration
  private readonly defaultTTL: number;
  private readonly maxCacheSize: number;

  // TTL configurations for different data types (in milliseconds)
  private readonly ttlConfig = {
    poolData: 60000, // 1 minute
    priceData: 15000, // 15 seconds
    gasPrice: 15000, // 15 seconds
    protocolHealth: 60000, // 1 minute
    tokenBalance: 30000, // 30 seconds
    liquidityPool: 60000, // 1 minute
    yieldRate: 120000, // 2 minutes
    contractAbi: 3600000, // 1 hour
    networkStatus: 30000, // 30 seconds
  };

  constructor(private readonly configService: ConfigService) {
    this.defaultTTL = this.configService.get<number>('CACHE_DEFAULT_TTL', 60000);
    this.maxCacheSize = this.configService.get<number>('CACHE_MAX_SIZE', 1000);

    this.logger.log('Protocol Cache initialized', {
      defaultTTL: this.defaultTTL,
      maxCacheSize: this.maxCacheSize,
    });

    // Start cache cleanup interval
    this.startCleanupInterval();
  }

  // ============================================================================
  // Cache Operations
  // ============================================================================

  /**
   * Get cached data
   * Implements caching for frequently accessed protocol data (Requirement 8.5)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.totalMisses++;
      this.logger.debug('Cache miss', { key });
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.totalMisses++;
      this.logger.debug('Cache expired', { key, age: now - entry.timestamp });
      return null;
    }

    // Update hit count
    entry.hits++;
    this.totalHits++;

    this.logger.debug('Cache hit', { key, hits: entry.hits });

    return entry.data as T;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0,
    };

    this.cache.set(key, entry);

    this.logger.debug('Cache set', { key, ttl: entry.ttl });
  }

  /**
   * Delete cached entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug('Cache entry deleted', { key });
    }
    return deleted;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // ============================================================================
  // Protocol-Specific Cache Methods
  // ============================================================================

  /**
   * Cache pool data (liquidity pools, trading pairs)
   */
  cachePoolData(protocol: string, poolId: string, data: any): void {
    const key = `pool:${protocol}:${poolId}`;
    this.set(key, data, this.ttlConfig.poolData);
  }

  getPoolData(protocol: string, poolId: string): any | null {
    const key = `pool:${protocol}:${poolId}`;
    return this.get(key);
  }

  /**
   * Cache price data
   */
  cachePriceData(token: string, price: string): void {
    const key = `price:${token}`;
    this.set(key, price, this.ttlConfig.priceData);
  }

  getPriceData(token: string): string | null {
    const key = `price:${token}`;
    return this.get(key);
  }

  /**
   * Cache gas price
   */
  cacheGasPrice(chainId: number, gasPrice: bigint): void {
    const key = `gas:${chainId}`;
    this.set(key, gasPrice.toString(), this.ttlConfig.gasPrice);
  }

  getGasPrice(chainId: number): bigint | null {
    const key = `gas:${chainId}`;
    const cached = this.get<string>(key);
    return cached ? BigInt(cached) : null;
  }

  /**
   * Cache protocol health status
   */
  cacheProtocolHealth(protocol: string, health: any): void {
    const key = `health:${protocol}`;
    this.set(key, health, this.ttlConfig.protocolHealth);
  }

  getProtocolHealth(protocol: string): any | null {
    const key = `health:${protocol}`;
    return this.get(key);
  }

  /**
   * Cache token balance
   */
  cacheTokenBalance(address: string, token: string, balance: bigint): void {
    const key = `balance:${address}:${token}`;
    this.set(key, balance.toString(), this.ttlConfig.tokenBalance);
  }

  getTokenBalance(address: string, token: string): bigint | null {
    const key = `balance:${address}:${token}`;
    const cached = this.get<string>(key);
    return cached ? BigInt(cached) : null;
  }

  /**
   * Cache yield rate
   */
  cacheYieldRate(protocol: string, pool: string, rate: number): void {
    const key = `yield:${protocol}:${pool}`;
    this.set(key, rate, this.ttlConfig.yieldRate);
  }

  getYieldRate(protocol: string, pool: string): number | null {
    const key = `yield:${protocol}:${pool}`;
    return this.get(key);
  }

  /**
   * Cache contract ABI (long TTL)
   */
  cacheContractAbi(address: string, abi: any): void {
    const key = `abi:${address}`;
    this.set(key, abi, this.ttlConfig.contractAbi);
  }

  getContractAbi(address: string): any | null {
    const key = `abi:${address}`;
    return this.get(key);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Evict least recently used entry
   */
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null;
    let leastHits = Infinity;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.hits < leastHits) {
        leastHits = entry.hits;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      this.logger.debug('Evicted least used entry', { key: leastUsedKey, hits: leastHits });
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug('Cleaned up expired entries', { count: expiredCount });
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Clear cache entries by pattern
   */
  clearByPattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.logger.debug('Cache entries cleared by pattern', { pattern, count });

    return count;
  }

  /**
   * Invalidate protocol-specific cache
   */
  invalidateProtocol(protocol: string): number {
    return this.clearByPattern(`^(pool|health|yield):${protocol}:`);
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  getMetrics(): CacheMetrics {
    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0;

    // Estimate memory usage (rough approximation)
    let memoryUsage = 0;
    for (const entry of Array.from(this.cache.values())) {
      memoryUsage += JSON.stringify(entry.data).length;
    }

    return {
      totalEntries: this.cache.size,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate,
      memoryUsage,
    };
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    size: number;
    hitRate: string;
    topHits: Array<{ key: string; hits: number }>;
    oldestEntry: { key: string; age: number } | null;
  } {
    const metrics = this.getMetrics();

    // Get top 10 most hit entries
    const entries = Array.from(this.cache.entries());
    const topHits = entries
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, 10)
      .map(([key, entry]) => ({ key, hits: entry.hits }));

    // Find oldest entry
    let oldestEntry: { key: string; age: number } | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestEntry = {
          key,
          age: Date.now() - entry.timestamp,
        };
      }
    }

    return {
      size: this.cache.size,
      hitRate: `${metrics.hitRate.toFixed(2)}%`,
      topHits,
      oldestEntry,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.totalHits = 0;
    this.totalMisses = 0;
    this.logger.log('Cache metrics reset');
  }
}
