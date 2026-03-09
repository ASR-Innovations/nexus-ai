import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { createHash } from 'crypto';
import { CacheService, CacheKeys } from '../cache.service';

export interface CacheInterceptorOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
  deduplication?: boolean;
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  protected readonly logger = new Logger(CacheInterceptor.name);
  protected readonly pendingRequests = new Map<string, Promise<any>>();

  constructor(
    protected readonly cacheService: CacheService,
    protected readonly options: CacheInterceptorOptions = {}
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip caching if specified
    if (this.options.skipCache?.(request)) {
      return next.handle();
    }

    // Generate cache key
    const cacheKey = this.options.keyGenerator 
      ? this.options.keyGenerator(request)
      : this.generateDefaultCacheKey(request);

    try {
      // Check for cached response
      const cachedResponse = await this.cacheService.get(cacheKey);
      if (cachedResponse !== null) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return of(cachedResponse);
      }

      // Handle request deduplication if enabled
      if (this.options.deduplication) {
        const pendingRequest = this.pendingRequests.get(cacheKey);
        if (pendingRequest) {
          this.logger.debug(`Request deduplication for key: ${cacheKey}`);
          const result = await pendingRequest;
          return of(result);
        }
      }

      // Execute request and cache response
      const responsePromise = next.handle().toPromise();
      
      if (this.options.deduplication) {
        this.pendingRequests.set(cacheKey, responsePromise);
      }

      return next.handle().pipe(
        tap(async (response) => {
          try {
            // Cache the response
            await this.cacheService.set(cacheKey, response, { 
              ttl: this.options.ttl 
            });
            this.logger.debug(`Cached response for key: ${cacheKey}`);
          } catch (error) {
            this.logger.error(`Failed to cache response for key ${cacheKey}:`, error);
          } finally {
            // Clean up pending request
            if (this.options.deduplication) {
              this.pendingRequests.delete(cacheKey);
            }
          }
        })
      );
    } catch (error) {
      this.logger.error(`Cache interceptor error for key ${cacheKey}:`, error);
      
      // Clean up pending request on error
      if (this.options.deduplication) {
        this.pendingRequests.delete(cacheKey);
      }
      
      // Continue without caching on error
      return next.handle();
    }
  }

  public generateDefaultCacheKey(request: Request): string {
    const method = request.method;
    const url = request.url;
    const body = request.body ? JSON.stringify(request.body) : '';
    const query = JSON.stringify(request.query);
    
    const content = `${method}:${url}:${query}:${body}`;
    return createHash('sha256').update(content).digest('hex');
  }
}

/**
 * Factory function to create cache interceptor with specific options
 */
/*
export function createCacheInterceptor(options: CacheInterceptorOptions = {}) {
  return class extends CacheInterceptor {
    constructor(cacheService: CacheService) {
      super(cacheService, options);
    }
  };
}
*/

/**
 * Specific interceptor for DeepSeek API queries
 */
@Injectable()
export class DeepSeekCacheInterceptor extends CacheInterceptor {
  constructor(cacheService: CacheService) {
    super(cacheService, {
      ttl: 60, // 60 seconds TTL for DeepSeek queries
      deduplication: true,
      keyGenerator: (req: Request) => {
        // Generate cache key based on message content and user ID
        const { message, userId } = req.body || {};
        if (!message) {
          return this.generateDefaultCacheKey(req);
        }
        
        // Create hash of message content for caching
        const messageHash = createHash('sha256')
          .update(message.toLowerCase().trim())
          .digest('hex');
        
        return CacheKeys.deepSeekQuery(messageHash);
      },
      skipCache: (req: Request) => {
        // Skip cache for non-POST requests or requests without message
        return req.method !== 'POST' || !req.body?.message;
      }
    });
  }
}

/**
 * Request deduplication interceptor for concurrent identical requests
 */
@Injectable()
export class RequestDeduplicationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestDeduplicationInterceptor.name);
  private readonly pendingRequests = new Map<string, Promise<any>>();

  constructor(private readonly cacheService: CacheService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Generate deduplication key
    const deduplicationKey = this.generateDeduplicationKey(request);
    
    try {
      // Check if there's already a pending request
      const pendingRequest = this.pendingRequests.get(deduplicationKey);
      if (pendingRequest) {
        this.logger.debug(`Request deduplication for key: ${deduplicationKey}`);
        const result = await pendingRequest;
        return of(result);
      }

      // Execute request
      const responsePromise = next.handle().toPromise();
      this.pendingRequests.set(deduplicationKey, responsePromise);

      return next.handle().pipe(
        tap({
          next: () => {
            this.pendingRequests.delete(deduplicationKey);
          },
          error: () => {
            this.pendingRequests.delete(deduplicationKey);
          }
        })
      );
    } catch (error) {
      this.logger.error(`Request deduplication error for key ${deduplicationKey}:`, error);
      this.pendingRequests.delete(deduplicationKey);
      return next.handle();
    }
  }

  private generateDeduplicationKey(request: Request): string {
    const method = request.method;
    const url = request.url;
    const body = request.body ? JSON.stringify(request.body) : '';
    const query = JSON.stringify(request.query);
    const userId = request.body?.userId || request.query?.userId || request.params?.address || 'anonymous';
    
    const content = `${method}:${url}:${query}:${body}:${userId}`;
    return `dedup:${createHash('sha256').update(content).digest('hex')}`;
  }
}