import { Controller, Get } from '@nestjs/common';
import { DatabaseProvider } from '../shared/database.provider';
import { RedisProvider } from '../shared/redis.provider';
import { ContractProvider } from '../shared/contract.provider';
import { CacheService } from '../shared/cache.service';

@Controller('health')
export class HealthController {
  constructor(
    private databaseProvider: DatabaseProvider,
    private redisProvider: RedisProvider,
    private contractProvider: ContractProvider,
    private cacheService: CacheService,
  ) {}

  @Get()
  async getHealth() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'unknown',
        cache: 'unknown',
        polkadotHub: 'unknown',
      },
      metrics: {
        redisLatency: 0,
        cacheLatency: 0,
      },
    };

    try {
      // Test database connection
      await this.databaseProvider.query('SELECT 1');
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }

    try {
      // Test Redis connection with latency measurement
      const start = Date.now();
      const isHealthy = this.redisProvider.isHealthy();
      await this.redisProvider.set('health_check', 'ok', 10);
      health.metrics.redisLatency = Date.now() - start;
      health.services.redis = isHealthy ? 'healthy' : 'unhealthy';
      
      if (!isHealthy) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
    }

    try {
      // Test cache service with latency measurement
      const cacheHealth = await this.cacheService.healthCheck();
      health.services.cache = cacheHealth.healthy ? 'healthy' : 'unhealthy';
      health.metrics.cacheLatency = cacheHealth.latency || 0;
      
      if (!cacheHealth.healthy) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.cache = 'unhealthy';
      health.status = 'degraded';
    }

    try {
      // Test Polkadot Hub connection
      const blockNumber = await this.contractProvider.getCurrentBlock();
      health.services.polkadotHub = blockNumber > 0 ? 'healthy' : 'unhealthy';
    } catch (error) {
      health.services.polkadotHub = 'unhealthy';
      health.status = 'degraded';
    }

    return health;
  }

  @Get('cache')
  async getCacheHealth() {
    return await this.cacheService.healthCheck();
  }

  @Get('redis')
  async getRedisHealth() {
    return {
      connected: this.redisProvider.isHealthy(),
      status: this.redisProvider.getClient().status,
    };
  }
}