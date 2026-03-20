import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionService } from './execution.service';

@Controller('execution')
@UseGuards(ThrottlerGuard)
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Get(':intentId')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getExecution(@Param('intentId') intentId: string) {
    return this.executionService.getExecution(parseInt(intentId));
  }
}