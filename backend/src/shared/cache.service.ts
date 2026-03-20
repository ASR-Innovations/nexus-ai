import { Injectable, Logger } from '@nestjs/common';
import { RedisProvider } from './redis.provider';

/**
 * Cache key naming conventions for NexusAI Protocol
 * 
 * Format: {category}:{subcategory}:{identifier}
 * 
 * Categories:
 * - yields: Yield data from parachains
 * - portfolio: User portfolio data
 * - indexer: Indexer state and locks
 * - ratelimit: Rate limiting counters
 * - deepseek: AI response caching
 * - memory: Mem0 memory caching
 * - gas: Gas estimation caching
 * - agent: Agent metadata caching
 */
export class CacheKeys {
  // Yield Data (TTL: 120s)
  static yields(asset: string): string {
    return `yields:${asset.toLowerCase()}`;
  }

  static yieldsLastUpdate(): string {
    return 'yields:last_update';
  }

  static yieldHistory(protocol: string, asset: string): string {
    return `yields:history:${protocol}:${asset.toLowerCase()}`;
  }

  // Portfolio Data (TTL: 30s)
  static portfolio(address: string): string {
    return `portfolio:${address.toLowerCase()}`;
  }

  static balance(address: string, chain: string): string {
    return `balance:${address.toLowerCase()}:${chain.toLowerCase()}`;
  }

  static yieldPositions(address: string): string {
    return `portfolio:positions:${address.toLowerCase()}`;
  }

  // Indexer State
  static indexerLastBlock(): string {
    return 'indexer:last_block';
  }

  static indexerProcessing(): string {
    return 'indexer:processing';
  }

  static indexerReorg(blockNumber: number): string {
    return `indexer:reorg:${blockNumber}`;
  }

  // Rate Limiting (TTL: 60s)
  static rateLimitChat(address: string): string {
    return `ratelimit:chat:${address.toLowerCase()}`;
  }

  static rateLimitIntent(address: string): string {
    return `ratelimit:intent:${address.toLowerCase()}`;
  }

  static rateLimitPortfolio(address: string): string {
    return `ratelimit:portfolio:${address.toLowerCase()}`;
  }

  // DeepSeek Cache (TTL: 60s)
  static deepSeekQuery(queryHash: string): string {
    return `deepseek:query:${queryHash}`;
  }

  static deepSeekRisk(strategyHash: string): string {
    return `deepseek:risk:${strategyHash}`;
  }

  // Memory Cache (TTL: 300s)
  static mem0Memories(userId: string): string {
    return `memory:${userId.toLowerCase()}`;
  }

  static mem0Search(userId: string, queryHash: string): string {
    return `memory:search:${userId.toLowerCase()}:${queryHash}`;
  }

  // Gas Estimation (TTL: 30s)
  static gasPrice(): string {
    return 'gas:price';
  }

  static gasEstimate(strategyHash: string): string {
    return `gas:estimate:${strategyHash}`;
  }

  // Agent Data (TTL: 60s)
  static agentMetadata(address: string): string {
    return `agent:metadata:${address.toLowerCase()}`;
  }

  static agentLeaderboard(sortBy: string, limit: number): string {
    return `agent:leaderboard:${sortBy}:${limit}`;
  }

  // XCM Tracking
  static xcmConfirmation(intentId: number, paraId: number): string {
    return `xcm:confirmation:${intentId}:${paraId}`;
  }

  // Price Data (TTL: 60s)
  static tokenPrice(symbol: string): string {
    return `price:${symbol.toLowerCase()}`;
  }

  // Static Data (TTL: 300s)
  static staticData(type?: string, identifier?: string): string {
    if (type && identifier) {
      return `static:${type}:${identifier.toLowerCase()}`;
    }
    return 'static:data';
  }

  // Yield Data Cache (TTL: 120s)
  static yieldData(asset?: string): string {
    if (asset) {
      return `yields:${asset.toLowerCase()}`;
    }
    return 'yields:data';
  }
}

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  fallbackValue?: any;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  // Default TTL values (in seconds)
  private readonly DEFAULT_TTLS = {
    yields: 120,
    portfolio: 30,
    ratelimit: 60,
    deepseek: 60,
    memory: 300,
    gas: 30,
    agent: 60,
    price: 60,
  };

  constructor(private readonly redisProvider: RedisProvider) {}

  /**
   * Get value from cache with automatic JSON parsing
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const value = await this.redisProvider.get(key);
      
      if (value === null) {
        this.logger.debug(`Cache miss for key: ${key}`);
        return options?.fallbackValue ?? null;
      }

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return options?.fallbackValue ?? null;
    }
  }

  /**
   * Set value in cache with automatic JSON serialization
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl ?? this.getTTLFromKey(key);
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      return await this.redisProvider.set(key, serializedValue, ttl);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        this.logger.debug(`Cache hit for key: ${key}`);
        return cached;
      }

      // Compute value
      this.logger.debug(`Computing value for key: ${key}`);
      const computed = await computeFn();
      
      // Cache the computed value
      await this.set(key, computed, options);
      
      return computed;
    } catch (error) {
      this.logger.error(`Cache getOrSet error for key ${key}:`, error);
      
      // If we have a fallback value, return it
      if (options?.fallbackValue !== undefined) {
        return options.fallbackValue;
      }
      
      throw error;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    return await this.redisProvider.del(key);
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    return await this.redisProvider.exists(key);
  }

  /**
   * Increment counter (useful for rate limiting)
   */
  async increment(key: string, ttl?: number): Promise<number | null> {
    try {
      const result = await this.redisProvider.incr(key);
      
      if (result === 1 && ttl) {
        // Set TTL only on first increment
        await this.redisProvider.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get multiple keys at once
   */
  async getMultiple<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redisProvider.mget(keys);
      
      return values.map((value, index) => {
        if (value === null) {
          this.logger.debug(`Cache miss for key: ${keys[index]}`);
          return null;
        }
        
        try {
          return JSON.parse(value);
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      this.logger.error(`Cache getMultiple error for keys ${keys.join(', ')}:`, error);
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Set multiple key-value pairs at once
   */
  async setMultiple(
    keyValuePairs: Record<string, any>,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const ttl = options?.ttl;
      const serializedPairs: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        serializedPairs[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
      
      return await this.redisProvider.mset(serializedPairs, ttl);
    } catch (error) {
      this.logger.error('Cache setMultiple error:', error);
      return false;
    }
  }

  /**
   * Clear all keys matching a pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const deletedCount = await this.redisProvider.flushPattern(pattern);
      this.logger.log(`Cleared ${deletedCount} keys matching pattern: ${pattern}`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Cache clearPattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Rate limiting helper
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; count: number; resetTime: number }> {
    try {
      const count = await this.increment(key, windowSeconds);
      
      if (count === null) {
        return { allowed: false, count: 0, resetTime: Date.now() + windowSeconds * 1000 };
      }
      
      const allowed = count <= limit;
      const resetTime = Date.now() + windowSeconds * 1000;
      
      return { allowed, count, resetTime };
    } catch (error) {
      this.logger.error(`Rate limit check error for key ${key}:`, error);
      return { allowed: true, count: 0, resetTime: Date.now() };
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number }> {
    try {
      const start = Date.now();
      const testKey = 'health:check';
      const testValue = Date.now().toString();
      
      await this.set(testKey, testValue, { ttl: 10 });
      const retrieved = await this.get(testKey);
      await this.delete(testKey);
      
      const latency = Date.now() - start;
      const healthy = retrieved === testValue;
      
      return { healthy, latency };
    } catch (error) {
      this.logger.error('Cache health check failed:', error);
      return { healthy: false };
    }
  }

  /**
   * Get TTL based on cache key pattern
   */
  private getTTLFromKey(key: string): number {
    if (key.startsWith('yields:')) return this.DEFAULT_TTLS.yields;
    if (key.startsWith('portfolio:')) return this.DEFAULT_TTLS.portfolio;
    if (key.startsWith('ratelimit:')) return this.DEFAULT_TTLS.ratelimit;
    if (key.startsWith('deepseek:')) return this.DEFAULT_TTLS.deepseek;
    if (key.startsWith('memory:')) return this.DEFAULT_TTLS.memory;
    if (key.startsWith('gas:')) return this.DEFAULT_TTLS.gas;
    if (key.startsWith('agent:')) return this.DEFAULT_TTLS.agent;
    if (key.startsWith('price:')) return this.DEFAULT_TTLS.price;
    
    // Default TTL for unknown patterns
    return 300; // 5 minutes
  }
}