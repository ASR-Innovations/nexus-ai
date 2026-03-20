import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AgentsService } from './agents.service';

@Controller('agents')
@UseGuards(ThrottlerGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getAgents(
    @Query('sort') sort: string = 'reputation',
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ) {
    return this.agentsService.getAgents(sort, parseInt(limit), parseInt(offset));
  }

  @Get(':address')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getAgent(@Param('address') address: string) {
    return this.agentsService.getAgent(address);
  }
}