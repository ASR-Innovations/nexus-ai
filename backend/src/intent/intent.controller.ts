import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { WalletAuthGuard } from '../shared/guards/wallet-auth.guard';
import { IntentService } from './intent.service';
import { CreateIntentDto, ApproveIntentDto, ExecuteIntentDto } from './intent.dto';

@Controller('api/intent')
@UseGuards(ThrottlerGuard)
export class IntentController {
  constructor(private readonly intentService: IntentService) {}

  @Post('create')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseGuards(WalletAuthGuard)
  async createIntent(@Body() createIntentDto: CreateIntentDto) {
    return this.intentService.createUnsignedTransaction(createIntentDto);
  }

  @Post('approve')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(WalletAuthGuard)
  async approveIntent(@Body() approveIntentDto: ApproveIntentDto) {
    return this.intentService.approveUnsignedTransaction(approveIntentDto);
  }

  @Post('execute')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(WalletAuthGuard)
  async executeIntent(@Body() executeIntentDto: ExecuteIntentDto) {
    return this.intentService.executeUnsignedTransaction(executeIntentDto);
  }

  @Get(':id')
  async getIntent(@Param('id') id: string) {
    return this.intentService.getIntent(parseInt(id));
  }

  @Get('user/:address')
  async getUserIntents(@Param('address') address: string) {
    return this.intentService.getUserIntents(address);
  }
}