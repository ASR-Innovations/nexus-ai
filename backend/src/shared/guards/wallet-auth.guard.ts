import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ethers } from 'ethers';

export interface WalletSignature {
  address: string;
  signature: string;
  message: string;
  timestamp: number;
}

export interface AuthenticatedRequest extends Request {
  walletAddress?: string;
  signatureData?: WalletSignature;
}

@Injectable()
export class WalletAuthGuard implements CanActivate {
  private readonly logger = new Logger(WalletAuthGuard.name);
  
  // Signature validity window (5 minutes)
  private readonly SIGNATURE_VALIDITY_MS = 5 * 60 * 1000;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Allow bypassing signature verification in development/testing
    if (process.env.SKIP_SIGNATURE_VERIFICATION === 'true') {
      const address = request.headers['x-wallet-address'] as string;
      if (address && ethers.isAddress(address)) {
        request.walletAddress = address;
        this.logger.debug(`[DEV] Skipping signature verification for: ${address}`);
        return true;
      } else {
        // In dev mode, allow requests even without valid wallet address
        this.logger.debug(`[DEV] Allowing request without valid wallet address (SKIP_SIGNATURE_VERIFICATION=true)`);
        return true;
      }
    }
    
    try {
      // Extract signature data from request
      const signatureData = this.extractSignatureData(request);
      
      if (!signatureData) {
        throw new UnauthorizedException('Missing wallet signature');
      }

      // Validate signature timestamp
      if (!this.isSignatureValid(signatureData.timestamp)) {
        throw new UnauthorizedException('Signature expired');
      }

      // Verify EIP-712 signature
      const isValidSignature = await this.verifySignature(signatureData);
      
      if (!isValidSignature) {
        throw new UnauthorizedException('Invalid wallet signature');
      }

      // Attach wallet address to request for use in controllers
      request.walletAddress = signatureData.address;
      request.signatureData = signatureData;

      this.logger.debug(`Authenticated wallet: ${signatureData.address}`);
      return true;

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      this.logger.error('Wallet authentication error:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Extract signature data from various request sources
   */
  private extractSignatureData(request: AuthenticatedRequest): WalletSignature | null {
    // Method 1: Authorization header (Bearer token with JSON)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (this.isValidSignatureData(decoded)) {
          return decoded;
        }
      } catch (error) {
        this.logger.debug('Failed to parse Bearer token:', error);
      }
    }

    // Method 2: Custom headers
    const address = request.headers['x-wallet-address'] as string;
    const signature = request.headers['x-wallet-signature'] as string;
    const message = request.headers['x-wallet-message'] as string;
    const timestamp = request.headers['x-wallet-timestamp'] as string;

    if (address && signature && message && timestamp) {
      return {
        address,
        signature,
        message,
        timestamp: parseInt(timestamp),
      };
    }

    // Method 3: Request body
    if (request.body && this.isValidSignatureData(request.body)) {
      return {
        address: request.body.address,
        signature: request.body.signature,
        message: request.body.message,
        timestamp: request.body.timestamp,
      };
    }

    // Method 4: Query parameters (less secure, for testing only)
    if (process.env.NODE_ENV === 'development') {
      const queryAddress = request.query.address as string;
      const querySignature = request.query.signature as string;
      const queryMessage = request.query.message as string;
      const queryTimestamp = request.query.timestamp as string;

      if (queryAddress && querySignature && queryMessage && queryTimestamp) {
        return {
          address: queryAddress,
          signature: querySignature,
          message: queryMessage,
          timestamp: parseInt(queryTimestamp),
        };
      }
    }

    return null;
  }

  /**
   * Validate signature data structure
   */
  private isValidSignatureData(data: any): boolean {
    return (
      data &&
      typeof data.address === 'string' &&
      typeof data.signature === 'string' &&
      typeof data.message === 'string' &&
      typeof data.timestamp === 'number' &&
      ethers.isAddress(data.address)
    );
  }

  /**
   * Check if signature timestamp is within validity window
   * Handles both seconds (10-digit) and milliseconds (13-digit) timestamps
   */
  private isSignatureValid(timestamp: number): boolean {
    const now = Date.now();
    // If timestamp is in seconds (10 digits), convert to ms; otherwise use as-is
    const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    const timeDiff = Math.abs(now - timestampMs);
    return timeDiff <= this.SIGNATURE_VALIDITY_MS;
  }

  /**
   * Verify EIP-712 wallet signature using ethers.js
   */
  private async verifySignature(signatureData: WalletSignature): Promise<boolean> {
    try {
      // Create the message that should have been signed
      const expectedMessage = this.createSignatureMessage(
        signatureData.address,
        signatureData.timestamp
      );

      // Verify the message matches what was provided
      if (signatureData.message !== expectedMessage) {
        this.logger.debug('Message mismatch in signature verification');
        return false;
      }

      // Verify the signature using ethers.js
      const recoveredAddress = ethers.verifyMessage(
        signatureData.message,
        signatureData.signature
      );

      // Check if recovered address matches claimed address
      const isValid = recoveredAddress.toLowerCase() === signatureData.address.toLowerCase();
      
      if (!isValid) {
        this.logger.debug(
          `Signature verification failed: expected ${signatureData.address}, got ${recoveredAddress}`
        );
      }

      return isValid;

    } catch (error) {
      this.logger.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Create standardized message for signing
   * This should match the message format used by the frontend
   */
  private createSignatureMessage(address: string, timestamp: number): string {
    return `NexusAI Protocol Authentication\n\nWallet: ${address}\nTimestamp: ${timestamp}\n\nBy signing this message, you authenticate your wallet for NexusAI Protocol operations.`;
  }

  /**
   * Utility method to create a signature message (for frontend reference)
   */
  static createAuthMessage(address: string, timestamp?: number): string {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    return `NexusAI Protocol Authentication\n\nWallet: ${address}\nTimestamp: ${ts}\n\nBy signing this message, you authenticate your wallet for NexusAI Protocol operations.`;
  }

  /**
   * Utility method to create Bearer token for frontend
   */
  static createBearerToken(signatureData: WalletSignature): string {
    const tokenData = JSON.stringify(signatureData);
    return Buffer.from(tokenData).toString('base64');
  }
}