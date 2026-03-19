import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  HttpException, 
  HttpStatus,
  Logger 
} from '@nestjs/common';
import { AgentBotService, AgentBotConfig } from './agent-bot.service';
import { MonitoringService } from './monitoring.service';
import { ExecutionEngineService } from './execution-engine.service';
import { ProtocolIntegrationService } from './protocol-integration.service';
import { DashboardService } from './dashboard.service';
import { RealProtocolIntegrationService } from './real-protocol-integration.service';
import { ProductionBotService } from './production-bot.service';

export class RegisterBotDto {
  name?: string;
  specialties?: string[];
  riskTolerance?: 'low' | 'medium' | 'high';
  maxActiveIntents?: number;
  minReputationThreshold?: number;
  autoExecute?: boolean;
}

export class ExecuteIntentDto {
  intentId: number;
  force?: boolean;
}

@Controller('agents/bot')
export class AgentBotController {
  private readonly logger = new Logger(AgentBotController.name);

  constructor(
    private agentBotService: AgentBotService,
    private monitoringService: MonitoringService,
    private executionEngine: ExecutionEngineService,
    private protocolIntegration: ProtocolIntegrationService,
    private dashboardService: DashboardService,
    private realProtocolIntegration: RealProtocolIntegrationService,
    private productionBot: ProductionBotService,
  ) {}

  @Get('status')
  async getBotStatus() {
    try {
      const status = await this.agentBotService.getBotStatus();
      const health = await this.monitoringService.getHealthStatus();
      
      return {
        success: true,
        data: {
          ...status,
          health,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get bot status:', error);
      throw new HttpException(
        'Failed to get bot status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('register')
  async registerBot(@Body() registerDto: RegisterBotDto) {
    try {
      this.logger.log('Registering agent bot with config:', registerDto);
      
      const result = await this.agentBotService.registerBot(registerDto);
      
      if (result.success) {
        return {
          success: true,
          message: 'Agent bot registered successfully',
          data: {
            transactionHash: result.transactionHash,
          },
        };
      } else {
        throw new HttpException(
          result.error || 'Registration failed',
          HttpStatus.BAD_REQUEST
        );
      }
    } catch (error) {
      this.logger.error('Bot registration failed:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Bot registration failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('start-monitoring')
  async startMonitoring() {
    try {
      await this.agentBotService.startManualMonitoring();
      
      return {
        success: true,
        message: 'Intent monitoring started',
      };
    } catch (error) {
      this.logger.error('Failed to start monitoring:', error);
      throw new HttpException(
        error.message || 'Failed to start monitoring',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('stop-monitoring')
  async stopMonitoring() {
    try {
      await this.agentBotService.stopMonitoring();
      
      return {
        success: true,
        message: 'Intent monitoring stopped',
      };
    } catch (error) {
      this.logger.error('Failed to stop monitoring:', error);
      throw new HttpException(
        'Failed to stop monitoring',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('metrics')
  async getBotMetrics(@Query('address') address?: string) {
    try {
      if (!address) {
        const status = await this.agentBotService.getBotStatus();
        address = status.address;
      }
      
      if (!address) {
        throw new HttpException(
          'Agent address not available',
          HttpStatus.BAD_REQUEST
        );
      }

      const metrics = await this.monitoringService.getBotMetrics(address);
      const performance = await this.monitoringService.getPerformanceStats();
      
      return {
        success: true,
        data: {
          metrics,
          performance,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get bot metrics:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to get bot metrics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('executions')
  async getExecutionHistory(@Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit) : 50;
      const executions = await this.monitoringService.getExecutionHistory(limitNum);
      
      return {
        success: true,
        data: {
          executions,
          total: executions.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get execution history:', error);
      throw new HttpException(
        'Failed to get execution history',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('executions/:intentId')
  async getExecutionStatus(@Param('intentId') intentId: string) {
    try {
      const intentIdNum = parseInt(intentId);
      const status = await this.executionEngine.getExecutionStatus(intentIdNum);
      
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error('Failed to get execution status:', error);
      throw new HttpException(
        'Failed to get execution status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('execute')
  async executeIntent(@Body() executeDto: ExecuteIntentDto) {
    try {
      this.logger.log(`Manual execution requested for intent ${executeDto.intentId}`);
      
      const result = await this.executionEngine.executeIntent(executeDto.intentId);
      
      return {
        success: result.success,
        message: result.success ? 'Execution completed successfully' : 'Execution failed',
        data: {
          transactionHash: result.transactionHash,
          gasUsed: result.gasUsed,
          executionTime: result.executionTime,
          error: result.error,
        },
      };
    } catch (error) {
      this.logger.error('Manual execution failed:', error);
      throw new HttpException(
        'Execution failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('protocols/hydration/pools')
  async getHydrationPools() {
    try {
      const pools = await this.protocolIntegration.getHydrationPools();
      
      return {
        success: true,
        data: {
          pools,
          count: pools.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get Hydration pools:', error);
      throw new HttpException(
        'Failed to get Hydration pools',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('protocols/bifrost/staking')
  async getBifrostStakingInfo() {
    try {
      const stakingInfo = await this.protocolIntegration.getBifrostStakingInfo();
      
      return {
        success: true,
        data: stakingInfo,
      };
    } catch (error) {
      this.logger.error('Failed to get Bifrost staking info:', error);
      throw new HttpException(
        'Failed to get Bifrost staking info',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('protocols/moonbeam/dexs')
  async getMoonbeamDexInfo() {
    try {
      const dexInfo = await this.protocolIntegration.getMoonbeamDexInfo();
      
      return {
        success: true,
        data: {
          dexs: dexInfo,
          count: dexInfo.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get Moonbeam DEX info:', error);
      throw new HttpException(
        'Failed to get Moonbeam DEX info',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('plan/generate')
  async generateExecutionPlan(@Body() body: { intent: any }) {
    try {
      const plan = await this.protocolIntegration.generateExecutionPlan(body.intent);
      const cost = await this.protocolIntegration.estimateExecutionCost(plan.steps);
      
      return {
        success: true,
        data: {
          plan,
          cost,
        },
      };
    } catch (error) {
      this.logger.error('Failed to generate execution plan:', error);
      throw new HttpException(
        'Failed to generate execution plan',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('plan/validate')
  async validateExecutionPlan(@Body() body: { steps: any[] }) {
    try {
      const validationResults = await Promise.all(
        body.steps.map(step => this.protocolIntegration.validateExecutionStep(step))
      );
      
      const allValid = validationResults.every(result => result.valid);
      const allErrors = validationResults.flatMap(result => result.errors);
      const allWarnings = validationResults.flatMap(result => result.warnings);
      
      return {
        success: true,
        data: {
          valid: allValid,
          errors: allErrors,
          warnings: allWarnings,
          stepResults: validationResults,
        },
      };
    } catch (error) {
      this.logger.error('Failed to validate execution plan:', error);
      throw new HttpException(
        'Failed to validate execution plan',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('health')
  async getHealthCheck() {
    try {
      const isHealthy = await this.monitoringService.isHealthy();
      const healthStatus = await this.monitoringService.getHealthStatus();
      
      return {
        success: true,
        data: {
          healthy: isHealthy,
          ...healthStatus,
        },
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw new HttpException(
        'Health check failed',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  @Get('config')
  async getBotConfig() {
    try {
      const status = await this.agentBotService.getBotStatus();
      
      // Return sanitized config (no private keys)
      return {
        success: true,
        data: {
          address: status.address,
          isRegistered: status.isRegistered,
          isMonitoring: status.isMonitoring,
          balance: status.balance,
          // Add other non-sensitive config here
        },
      };
    } catch (error) {
      this.logger.error('Failed to get bot config:', error);
      throw new HttpException(
        'Failed to get bot config',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('intents/available')
  async getAvailableIntents(@Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit) : 10;
      
      // This would typically query the database for available intents
      // For now, return empty array as placeholder
      return {
        success: true,
        data: {
          intents: [],
          total: 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get available intents:', error);
      throw new HttpException(
        'Failed to get available intents',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('intents/:intentId/claim')
  async claimIntent(@Param('intentId') intentId: string) {
    try {
      const intentIdNum = parseInt(intentId);
      
      // This would trigger the claim process
      // For now, return success as placeholder
      return {
        success: true,
        message: `Intent ${intentId} claim initiated`,
        data: {
          intentId: intentIdNum,
          status: 'claiming',
        },
      };
    } catch (error) {
      this.logger.error('Failed to claim intent:', error);
      throw new HttpException(
        'Failed to claim intent',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('dashboard')
  async getDashboardData() {
    try {
      const dashboardData = await this.dashboardService.getDashboardData();
      
      return {
        success: true,
        data: dashboardData,
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard data:', error);
      throw new HttpException(
        'Failed to get dashboard data',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('dashboard/realtime')
  async getRealtimeMetrics() {
    try {
      const realtimeMetrics = await this.dashboardService.getRealtimeMetrics();
      
      return {
        success: true,
        data: realtimeMetrics,
      };
    } catch (error) {
      this.logger.error('Failed to get realtime metrics:', error);
      throw new HttpException(
        'Failed to get realtime metrics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('protocols/real/hydration/pools')
  async getRealHydrationPools() {
    try {
      const pools = await this.realProtocolIntegration.getHydrationPools();
      
      return {
        success: true,
        data: {
          pools,
          count: pools.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get real Hydration pools:', error);
      throw new HttpException(
        'Failed to get real Hydration pools',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('protocols/real/bifrost/staking')
  async getRealBifrostStaking() {
    try {
      const stakingInfo = await this.realProtocolIntegration.getBifrostStakingInfo();
      
      return {
        success: true,
        data: {
          staking: stakingInfo,
          count: stakingInfo.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get real Bifrost staking:', error);
      throw new HttpException(
        'Failed to get real Bifrost staking',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('protocols/real/moonbeam/dexs')
  async getRealMoonbeamDexs() {
    try {
      const pools = await this.realProtocolIntegration.getMoonbeamDexPools();
      
      return {
        success: true,
        data: {
          pools,
          count: pools.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get real Moonbeam DEXs:', error);
      throw new HttpException(
        'Failed to get real Moonbeam DEXs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('protocols/real/quote/swap')
  async getRealSwapQuote(@Body() body: {
    protocol: string;
    chain: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
  }) {
    try {
      let quote = null;
      
      if (body.chain === 'hydration') {
        quote = await this.realProtocolIntegration.getHydrationSwapQuote(
          body.tokenIn,
          body.tokenOut,
          body.amountIn
        );
      } else if (body.chain === 'moonbeam') {
        quote = await this.realProtocolIntegration.getMoonbeamSwapQuote(
          body.protocol,
          body.tokenIn,
          body.tokenOut,
          body.amountIn
        );
      }
      
      if (!quote) {
        throw new HttpException(
          'Unable to get quote for this pair',
          HttpStatus.BAD_REQUEST
        );
      }
      
      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      this.logger.error('Failed to get real swap quote:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to get swap quote',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('protocols/real/quote/stake')
  async getRealStakeQuote(@Body() body: {
    asset: string;
    amount: string;
  }) {
    try {
      const quote = await this.realProtocolIntegration.getBifrostMintQuote(
        body.asset,
        body.amount
      );
      
      if (!quote) {
        throw new HttpException(
          'Unable to get staking quote for this asset',
          HttpStatus.BAD_REQUEST
        );
      }
      
      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      this.logger.error('Failed to get real stake quote:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to get stake quote',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('protocols/real/prices')
  async getRealTokenPrices(@Query('tokens') tokens?: string) {
    try {
      const tokenList = tokens ? tokens.split(',') : ['DOT', 'KSM', 'GLMR', 'USDT', 'USDC'];
      const prices = await this.realProtocolIntegration.getTokenPrices(tokenList);
      
      return {
        success: true,
        data: {
          prices,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get real token prices:', error);
      throw new HttpException(
        'Failed to get token prices',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('protocols/real/network-status')
  async getRealNetworkStatus() {
    try {
      const networkStatus = await this.realProtocolIntegration.getNetworkStatus();
      
      return {
        success: true,
        data: networkStatus,
      };
    } catch (error) {
      this.logger.error('Failed to get real network status:', error);
      throw new HttpException(
        'Failed to get network status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('strategies/optimize')
  async optimizeStrategy(@Body() body: {
    asset: string;
    amount: string;
    riskTolerance: 'low' | 'medium' | 'high';
  }) {
    try {
      const opportunity = await this.realProtocolIntegration.findBestYieldOpportunity(
        body.asset,
        body.amount,
        body.riskTolerance
      );
      
      if (!opportunity) {
        return {
          success: true,
          data: null,
          message: 'No suitable opportunities found for the given parameters',
        };
      }
      
      return {
        success: true,
        data: opportunity,
      };
    } catch (error) {
      this.logger.error('Failed to optimize strategy:', error);
      throw new HttpException(
        'Failed to optimize strategy',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ============================================================================
  // Production Bot Endpoints (24/7 Autonomous Operation)
  // ============================================================================

  @Get('production/status')
  async getProductionBotStatus() {
    try {
      const status = this.productionBot.getStatus();
      
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error('Failed to get production bot status:', error);
      throw new HttpException(
        'Failed to get production bot status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('production/health')
  async getProductionBotHealth() {
    try {
      const health = await this.productionBot.getHealth();
      
      return {
        success: true,
        data: health,
      };
    } catch (error) {
      this.logger.error('Failed to get production bot health:', error);
      throw new HttpException(
        'Failed to get production bot health',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('production/start')
  async startProductionBot() {
    try {
      await this.productionBot.start();
      
      return {
        success: true,
        message: 'Production bot started successfully',
      };
    } catch (error) {
      this.logger.error('Failed to start production bot:', error);
      throw new HttpException(
        'Failed to start production bot',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('production/stop')
  async stopProductionBot() {
    try {
      await this.productionBot.stop();
      
      return {
        success: true,
        message: 'Production bot stopped successfully',
      };
    } catch (error) {
      this.logger.error('Failed to stop production bot:', error);
      throw new HttpException(
        'Failed to stop production bot',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('production/pause')
  async pauseProductionBot() {
    try {
      await this.productionBot.pause();
      
      return {
        success: true,
        message: 'Production bot paused successfully',
      };
    } catch (error) {
      this.logger.error('Failed to pause production bot:', error);
      throw new HttpException(
        'Failed to pause production bot',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('production/resume')
  async resumeProductionBot() {
    try {
      await this.productionBot.resume();
      
      return {
        success: true,
        message: 'Production bot resumed successfully',
      };
    } catch (error) {
      this.logger.error('Failed to resume production bot:', error);
      throw new HttpException(
        'Failed to resume production bot',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}