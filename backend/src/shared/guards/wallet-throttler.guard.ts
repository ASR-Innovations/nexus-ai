import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class WalletThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Extract wallet address from various sources
    const walletAddress = this.extractWalletAddress(req);
    
    // Fallback to IP if no wallet address found
    return walletAddress || req.ip || 'anonymous';
  }

  private extractWalletAddress(req: Request): string | null {
    // Check Authorization header for wallet address
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Wallet ')) {
      return authHeader.substring(7); // Remove 'Wallet ' prefix
    }

    // Check x-wallet-address header
    const walletHeader = req.headers['x-wallet-address'] as string;
    if (walletHeader) {
      return walletHeader;
    }

    // Check request body for userId (wallet address)
    if (req.body && req.body.userId) {
      return req.body.userId;
    }

    // Check query parameters
    if (req.query && req.query.userId) {
      return req.query.userId as string;
    }

    // Check URL parameters (for routes like /api/portfolio/:address)
    if (req.params && req.params.address) {
      return Array.isArray(req.params.address) ? req.params.address[0] : req.params.address;
    }

    return null;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();
    
    // Get the current rate limit info
    const tracker = await this.getTracker(request);
    // TODO: Fix getRecord method - not available on ThrottlerStorage
    // const ttl = await this.storageService.getRecord(tracker);
    const ttl = null;
    
    // Set Retry-After header
    if (ttl && (ttl as any).timeToExpire) {
      const retryAfter = Math.ceil((ttl as any).timeToExpire / 1000);
      response.setHeader('Retry-After', retryAfter);
    }

    throw new ThrottlerException('Rate limit exceeded. Please try again later.');
  }
}