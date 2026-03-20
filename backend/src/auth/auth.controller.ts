import { Controller, Post, Body, Logger, BadRequestException } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ethers } from 'ethers';

// @ApiTags('Authentication')
@Controller('auth')
@SkipThrottle()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor() {}

  @Post('verify-signature')
  // @ApiOperation({ summary: 'Verify wallet signature' })
  // @ApiResponse({ status: 200, description: 'Signature verified successfully' })
  async verifySignature(@Body() body: { address: string; signature: string; message: string }) {
    try {
      // Validate input
      if (!body.address || !body.signature || !body.message) {
        throw new BadRequestException('Missing required fields: address, signature, message');
      }

      if (!ethers.isAddress(body.address)) {
        throw new BadRequestException('Invalid Ethereum address');
      }

      // Verify the signature using ethers.js
      const recoveredAddress = ethers.verifyMessage(body.message, body.signature);

      // Check if recovered address matches claimed address
      const isValid = recoveredAddress.toLowerCase() === body.address.toLowerCase();

      if (!isValid) {
        this.logger.warn(
          `Signature verification failed: expected ${body.address}, got ${recoveredAddress}`
        );
        return {
          success: false,
          message: 'Signature verification failed',
          address: body.address,
          timestamp: Date.now(),
        };
      }

      this.logger.log(`Signature verified successfully for address: ${body.address}`);

      return {
        success: true,
        message: 'Signature verified successfully',
        address: body.address,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error('Signature verification error:', error);
      throw new BadRequestException('Failed to verify signature');
    }
  }

  @Post('nonce')
  // @ApiOperation({ summary: 'Get nonce for signature' })
  // @ApiResponse({ status: 200, description: 'Nonce generated successfully' })
  async getNonce(@Body() body: { address: string }) {
    try {
      // Validate input
      if (!body.address) {
        throw new BadRequestException('Missing required field: address');
      }

      if (!ethers.isAddress(body.address)) {
        throw new BadRequestException('Invalid Ethereum address');
      }

      // Generate timestamp (in seconds for consistency)
      const timestamp = Math.floor(Date.now() / 1000);

      // Create the standardized authentication message
      const message = this.createAuthMessage(body.address, timestamp);

      // Generate a nonce for tracking (optional, for future use)
      const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      this.logger.log(`Generated nonce for address: ${body.address}`);

      return {
        success: true,
        nonce,
        address: body.address,
        timestamp,
        message, // This is the full formatted message to sign
      };
    } catch (error) {
      this.logger.error('Nonce generation error:', error);
      throw new BadRequestException('Failed to generate nonce');
    }
  }

  /**
   * Create standardized authentication message
   * This MUST match the format expected by WalletAuthGuard
   */
  private createAuthMessage(address: string, timestamp: number): string {
    return `NexusAI Protocol Authentication\n\nWallet: ${address}\nTimestamp: ${timestamp}\n\nBy signing this message, you authenticate your wallet for NexusAI Protocol operations.`;
  }
}