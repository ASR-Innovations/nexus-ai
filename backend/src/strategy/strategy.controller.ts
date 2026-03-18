import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('strategy')
@Controller('api/strategy')
export class StrategyController {
  @Get('templates')
  @ApiOperation({ summary: 'Get strategy templates' })
  @ApiResponse({ status: 200, description: 'Strategy templates retrieved successfully' })
  async getTemplates() {
    return {
      templates: [
        {
          id: 'yield-farming',
          name: 'Yield Farming Strategy',
          description: 'Automated yield farming across multiple protocols',
          riskLevel: 'medium',
          expectedApy: '12-18%',
          protocols: ['Acala', 'Moonbeam', 'Astar']
        },
        {
          id: 'liquid-staking',
          name: 'Liquid Staking Strategy', 
          description: 'Stake assets while maintaining liquidity',
          riskLevel: 'low',
          expectedApy: '8-12%',
          protocols: ['Lido', 'Bifrost']
        }
      ],
      totalTemplates: 2
    };
  }

  @Get('protocols')
  @ApiOperation({ summary: 'Get supported protocols' })
  async getProtocols() {
    return {
      protocols: [
        {
          name: 'Acala',
          tvl: '$125M',
          apy: '15.2%',
          riskScore: 7.5,
          status: 'active'
        },
        {
          name: 'Moonbeam',
          tvl: '$89M', 
          apy: '12.8%',
          riskScore: 8.2,
          status: 'active'
        }
      ],
      totalProtocols: 2
    };
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate custom strategy' })
  @ApiResponse({ status: 201, description: 'Strategy generated successfully' })
  async generateStrategy(@Body() body: any) {
    return {
      strategyId: Date.now().toString(),
      name: 'Custom Strategy',
      steps: [
        { action: 'swap', from: 'USDC', to: 'DOT', amount: '1000' },
        { action: 'stake', asset: 'DOT', protocol: 'Acala' }
      ],
      estimatedApy: '14.5%',
      riskLevel: 'medium',
      createdAt: new Date()
    };
  }
}