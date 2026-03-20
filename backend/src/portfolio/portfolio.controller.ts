import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
@UseGuards(ThrottlerGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':address')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getPortfolio(@Param('address') address: string) {
    return this.portfolioService.getPortfolio(address);
  }
}