import { Controller, Get } from '@nestjs/common';

// @ApiTags('yields')
@Controller('yields')
export class YieldsController {
  @Get('opportunities')
  // @ApiOperation({ summary: 'Get yield opportunities' })
  // @ApiResponse({ status: 200, description: 'Yield opportunities retrieved successfully' })
  async getOpportunities() {
    return {
      opportunities: [
        {
          protocol: 'Acala',
          asset: 'DOT',
          apy: '15.2%',
          tvl: '$125M',
          riskScore: 7.5,
          category: 'staking'
        },
        {
          protocol: 'Moonbeam',
          asset: 'GLMR',
          apy: '12.8%',
          tvl: '$89M',
          riskScore: 8.2,
          category: 'liquidity-mining'
        }
      ],
      totalOpportunities: 2
    };
  }

  @Get('protocols')
  // @ApiOperation({ summary: 'Get yield protocols' })
  async getProtocols() {
    return {
      protocols: [
        { name: 'Acala', tvl: '$125M', avgApy: '15.2%' },
        { name: 'Moonbeam', tvl: '$89M', avgApy: '12.8%' }
      ]
    };
  }

  @Get('native')
  // @ApiOperation({ summary: 'Get native staking yields' })
  async getNativeYields() {
    return {
      nativeYields: [
        { chain: 'Polkadot', asset: 'DOT', apy: '14.5%', minStake: '10 DOT' },
        { chain: 'Kusama', asset: 'KSM', apy: '16.2%', minStake: '1 KSM' }
      ]
    };
  }

  @Get('parachain')
  // @ApiOperation({ summary: 'Get parachain yields' })
  async getParachainYields() {
    return {
      parachainYields: [
        { parachain: 'Acala', apy: '15.2%', category: 'defi' },
        { parachain: 'Moonbeam', apy: '12.8%', category: 'smart-contracts' }
      ]
    };
  }

  @Get('historical')
  // @ApiOperation({ summary: 'Get historical yield data' })
  async getHistoricalYields() {
    return {
      historicalData: [
        { date: '2024-01-01', avgApy: '14.2%' },
        { date: '2024-01-02', avgApy: '14.5%' }
      ]
    };
  }
}