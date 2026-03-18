import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor() {}

  @Post('verify-signature')
  @ApiOperation({ summary: 'Verify wallet signature' })
  @ApiResponse({ status: 200, description: 'Signature verified successfully' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifySignature(@Body() body: any) {
    // For now, return a simple success response
    // In production, this would verify the wallet signature
    return {
      success: true,
      message: 'Signature verification not implemented yet',
      address: body.address || 'unknown',
      timestamp: Date.now(),
    };
  }

  @Post('nonce')
  @ApiOperation({ summary: 'Get nonce for signature' })
  @ApiResponse({ status: 200, description: 'Nonce generated successfully' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getNonce(@Body() body: any) {
    // Generate a simple nonce for signature verification
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    return {
      success: true,
      nonce,
      address: body.address || 'unknown',
      timestamp: Date.now(),
      message: `Please sign this message to verify your wallet: ${nonce}`,
    };
  }
}