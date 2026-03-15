/**
 * Rate Limit Guard
 * 
 * Guard to enforce rate limiting on intent creation endpoints.
 * Validates that agents don't exceed the 10 active intent limit.
 */

import { Injectable, CanActivate, ExecutionContext, BadRequestException, Logger } from '@nestjs/common';
import { RateLimitService } from '../services/rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Extract agent address from request
    // This could come from JWT token, request body, or headers
    const agentAddress = this.extractAgentAddress(request);
    
    if (!agentAddress) {
      this.logger.warn('No agent address found in request for rate limiting');
      throw new BadRequestException('Agent address required for rate limiting');
    }

    try {
      // Check rate limit
      const result = await this.rateLimitService.checkLimit(agentAddress);
      
      if (!result.allowed) {
        this.logger.warn(`Rate limit exceeded for agent ${agentAddress}: ${result.currentCount}/${result.maxCount}`);
        
        throw new BadRequestException({
          error: 'Rate Limit Exceeded',
          message: `Agent has reached maximum active intent limit of ${result.maxCount}. Current count: ${result.currentCount}. Please complete or cancel existing intents before creating new ones.`,
          code: 'RATE_LIMIT_EXCEEDED',
          agentAddress,
          currentCount: result.currentCount,
          maxCount: result.maxCount
        });
      }

      // Add rate limit info to request for logging/monitoring
      request.rateLimitInfo = {
        agentAddress,
        currentCount: result.currentCount,
        maxCount: result.maxCount,
        allowed: result.allowed
      };

      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(`Rate limit check failed for agent ${agentAddress}:`, error);
      throw new BadRequestException('Rate limit validation failed');
    }
  }

  /**
   * Extract agent address from request
   */
  private extractAgentAddress(request: any): string | null {
    // Try to get from JWT user (if using wallet auth)
    if (request.user?.address) {
      return request.user.address;
    }

    // Try to get from request body
    if (request.body?.userId) {
      return request.body.userId;
    }

    // Try to get from headers
    if (request.headers['x-agent-address']) {
      return request.headers['x-agent-address'];
    }

    return null;
  }
}