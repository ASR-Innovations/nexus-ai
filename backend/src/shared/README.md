# Redis Cache Setup - NexusAI Protocol

This document describes the Redis cache implementation for the NexusAI Protocol backend.

## Overview

The Redis cache system provides:
- **Connection Management**: Automatic retry logic with exponential backoff
- **Cache Key Conventions**: Structured naming for different data types
- **TTL Management**: Automatic expiration based on data type
- **Rate Limiting**: Built-in rate limiting functionality
- **Health Monitoring**: Connection status and latency tracking
- **Error Handling**: Graceful degradation when Redis is unavailable

## Components

### RedisProvider (`redis.provider.ts`)

Low-level Redis client wrapper with:
- Connection retry logic with exponential backoff
- Health monitoring and status tracking
- Event-driven connection management
- Error handling and logging
- Basic Redis operations (get, set, del, etc.)

### CacheService (`cache.service.ts`)

High-level cache abstraction with:
- Automatic JSON serialization/deserialization
- TTL management based on cache key patterns
- Rate limiting helpers
- Batch operations (mget, mset)
- Pattern-based cache clearing
- Health check functionality

## Cache Key Conventions

All cache keys follow the pattern: `{category}:{subcategory}:{identifier}`

### Categories and TTLs

| Category | TTL | Purpose | Example |
|----------|-----|---------|---------|
| `yields` | 120s | Yield data from parachains | `yields:dot`, `yields:history:hydration:dot` |
| `portfolio` | 30s | User portfolio data | `portfolio:0x123...`, `balance:0x123...:hydration` |
| `ratelimit` | 60s | Rate limiting counters | `ratelimit:chat:0x123...` |
| `deepseek` | 60s | AI response caching | `deepseek:query:abc123`, `deepseek:risk:def456` |
| `memory` | 300s | Mem0 memory caching | `memory:0x123...`, `memory:search:0x123...:query123` |
| `gas` | 30s | Gas estimation caching | `gas:price`, `gas:estimate:strategy123` |
| `agent` | 60s | Agent metadata caching | `agent:metadata:0x123...`, `agent:leaderboard:reputation:20` |
| `price` | 60s | Token price data | `price:dot`, `price:ksm` |

## Usage Examples

### Basic Cache Operations

```typescript
import { CacheService, CacheKeys } from '../shared/cache.service';

@Injectable()
export class YieldService {
  constructor(private cacheService: CacheService) {}

  async getYields(asset: string) {
    const key = CacheKeys.yields(asset);
    
    // Get from cache or compute
    return await this.cacheService.getOrSet(
      key,
      async () => {
        // Fetch from external API
        return await this.fetchYieldsFromAPI(asset);
      },
      { ttl: 120 } // Optional: override default TTL
    );
  }
}
```

### Rate Limiting

```typescript
async processRequest(userId: string) {
  const key = CacheKeys.rateLimitChat(userId);
  const rateLimit = await this.cacheService.checkRateLimit(key, 30, 60);
  
  if (!rateLimit.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${rateLimit.resetTime - Date.now()}ms`);
  }
  
  // Process request...
}
```

### Batch Operations

```typescript
// Get multiple values
const keys = [CacheKeys.yields('dot'), CacheKeys.yields('ksm')];
const values = await this.cacheService.getMultiple(keys);

// Set multiple values
const data = {
  [CacheKeys.yields('dot')]: dotYields,
  [CacheKeys.yields('ksm')]: ksmYields,
};
await this.cacheService.setMultiple(data, { ttl: 120 });
```

### Cache Invalidation

```typescript
// Clear specific pattern
await this.cacheService.clearPattern('yields:*');

// Clear user-specific data
await this.cacheService.clearPattern(`portfolio:${userId.toLowerCase()}*`);
```

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3
```

### Connection Options

The Redis client is configured with:
- **Connection timeout**: 10 seconds
- **Command timeout**: 5 seconds
- **Max retries**: 3 attempts
- **Retry delay**: Exponential backoff (100ms, 200ms, 400ms, etc.)
- **Lazy connect**: Connection established on first operation

## Health Monitoring

### Health Check Endpoints

- `GET /health` - Overall system health including Redis
- `GET /health/cache` - Cache service health check
- `GET /health/redis` - Redis connection status

### Health Check Response

```json
{
  "healthy": true,
  "latency": 15
}
```

### Monitoring Metrics

The health check measures:
- **Connection status**: Whether Redis is connected and ready
- **Latency**: Round-trip time for set/get/delete operations
- **Error rates**: Tracked in application logs

## Error Handling

### Graceful Degradation

When Redis is unavailable:
- Cache operations return `null` or `false` instead of throwing
- Rate limiting allows requests through (fail-open)
- Applications can continue with degraded performance
- Errors are logged but don't crash the application

### Retry Logic

Connection failures trigger:
1. Exponential backoff retry (1s, 2s, 4s, 8s, 16s)
2. Maximum 5 retry attempts
3. Automatic reconnection on network recovery
4. Event-driven status updates

## Best Practices

### Cache Key Design

1. **Use structured naming**: Follow the `category:subcategory:identifier` pattern
2. **Lowercase identifiers**: Normalize addresses and symbols to lowercase
3. **Avoid special characters**: Use only alphanumeric, colon, and dash
4. **Include version info**: Add version suffix for breaking changes

### TTL Management

1. **Match data freshness needs**: Shorter TTL for real-time data
2. **Consider API rate limits**: Longer TTL for expensive external calls
3. **Use appropriate defaults**: Let CacheService auto-detect TTL from key pattern
4. **Monitor cache hit rates**: Adjust TTL based on usage patterns

### Memory Management

1. **Set appropriate TTLs**: Prevent memory leaks from stale data
2. **Use pattern clearing**: Clean up related keys together
3. **Monitor memory usage**: Track Redis memory consumption
4. **Implement cache warming**: Pre-populate frequently accessed data

### Error Handling

1. **Always handle cache failures**: Don't let cache errors break core functionality
2. **Use fallback values**: Provide sensible defaults when cache is unavailable
3. **Log cache errors**: Monitor for patterns that indicate issues
4. **Implement circuit breakers**: Temporarily disable cache on repeated failures

## Testing

### Unit Tests

```typescript
describe('CacheService', () => {
  it('should cache and retrieve values', async () => {
    const key = 'test:key';
    const value = { data: 'test' };
    
    await cacheService.set(key, value);
    const retrieved = await cacheService.get(key);
    
    expect(retrieved).toEqual(value);
  });
});
```

### Integration Tests

```typescript
describe('Redis Integration', () => {
  it('should handle Redis unavailability gracefully', async () => {
    // Stop Redis container
    await stopRedis();
    
    // Should not throw
    const result = await cacheService.get('test:key');
    expect(result).toBeNull();
  });
});
```

## Troubleshooting

### Common Issues

1. **Connection timeouts**: Check network connectivity and Redis server status
2. **Memory issues**: Monitor Redis memory usage and set appropriate maxmemory policy
3. **High latency**: Check network latency and Redis server performance
4. **Authentication errors**: Verify REDIS_PASSWORD configuration

### Debugging

Enable debug logging:
```typescript
// In development
const logger = new Logger('CacheService');
logger.debug('Cache operation details...');
```

Check Redis directly:
```bash
redis-cli -h localhost -p 6379
> INFO memory
> KEYS yields:*
> TTL yields:dot
```

### Performance Tuning

1. **Use pipelining**: Batch multiple operations
2. **Optimize key patterns**: Avoid expensive KEYS operations
3. **Set memory policies**: Configure maxmemory-policy
4. **Monitor slow queries**: Use Redis SLOWLOG