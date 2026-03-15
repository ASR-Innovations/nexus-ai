/**
 * Rate Limit Interceptor
 * 
 * Interceptor to handle rate limiting with enhanced error messages and monitoring.
 * Provides detailed feedback when rate limits are exceeded.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { RateLimitService } from '../services/rate-limit.service';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);

  constructor(private readonly rateLimitService: RateLimitService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    return next.handle().pipe(
      tap(() => {
        // Log successful requests with rate limit info
        if (request.rateLimitInfo) {
          this.logger.debug(
            `Request processed for agent ${request.rateLimitInfo.agentAddress}: ` +
            `${request.rateLimitInfo.currentCount}/${request.rateLimitInfo.maxCount} intents`
          );
        }
      }),
      catchError((error) => {
        // Enhanced error handling for rate limit violations
        if (error.message?.includes('rate limit') || error.message?.includes('maximum active intent limit')) {
          const agentAddress = this.extractAgentAddress(request);
          
          return this.handleRateLimitError(error, agentAddress);
        }
        
        return throwError(() => error);
      })
    );
  }

  /**
   * Handle rate limit errors with enhanced messaging
   */
  private async handleRateLimitError(error: any, agentAddress: string | null): Promise<Observable<never>> {
    try {
      if (agentAddress) {
        const result = await this.rateLimitService.checkLimit(agentAddress);
        
        const enhancedError = new BadRequestException({
          error: 'Rate Limit Exceeded',
          message: `You have reached the maximum limit of ${result.maxCount} active intents. ` +
                  `Current active intents: ${result.currentCount}. ` +
                  `Please complete or cancel existing intents before creating new ones.`,
          code: 'RATE_LIMIT_EXCEEDED',
          agentAddress,
          currentCount: result.currentCount,
          maxCount: result.maxCount,
          suggestions: [
            'Complete existing intents by executing them',
            'Cancel intents that are no longer needed',
            'Wait for intents to expire naturally',
            'Check your active intents at /api/intent/user/' + agentAddress
          ]
        });
        
        this.logger.warn(`Rate limit exceeded for agent ${agentAddress}:`, {
          currentCount: result.currentCount,
          maxCount: result.maxCount,
          originalError: error.message
        });
        
        return throwError(() => enhancedError);
      }
    } catch (checkError) {
      this.logger.error('Failed to enhance rate limit error:', checkError);
    }
    
    // Fallback to original error if enhancement fails
    return throwError(() => error);
  }

  /**
   * Extract agent address from request
   */
  private extractAgentAddress(request: any): string | null {
    if (request.user?.address) {
      return request.user.address;
    }
    
    if (request.body?.userId) {
      return request.body.userId;
    }
    
    if (request.headers['x-agent-address']) {
      return request.headers['x-agent-address'];
    }
    
    return null;
  }
}