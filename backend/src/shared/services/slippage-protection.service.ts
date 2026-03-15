import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractService } from '../contract.service';
import { PricingService } from '../pricing.service';
import { SecurityError, SECURITY_ERRORS, SlippageParams } from '../types/contract.types';

export interface MarketCondition {
  volatility: number; // Percentage (0-100)
  liquidity: number; // USD value
  priceImpact: number; // Percentage (0-100)
}

export interface SlippageValidationResult {
  isValid: boolean;
  calculatedSlippage: number; // In BPS
  recommendedSlippage: number; // In BPS
  errors: SecurityError[];
  warnings: string[];
}

export interface DynamicSlippageConfig {
  baseSlippageBps: number;
  volatilityMultiplier: number;
  liquidityThreshold: number;
  maxDynamicSlippageBps: number;
}

@Injectable()
export class SlippageProtectionService {
  private readonly logger = new Logger(SlippageProtectionService.name);
  private readonly defaultConfig: DynamicSlippageConfig = {
    baseSlippageBps: 50, // 0.5%
    volatilityMultiplier: 2.0,
    liquidityThreshold: 100000, // $100k USD
    maxDynamicSlippageBps: 500, // 5%
  };

  constructor(
    private contractService: ContractService,
    private pricingService: PricingService,
    private configService: ConfigService
  ) {}

  /**
   * Validates slippage protection parameters
   * Requirements: 7.1 - Slippage parameter validation logic
   */
  async validateSlippageParameters(params: SlippageParams): Promise<SlippageValidationResult> {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    try {
      // Validate basic parameter ranges
      if (params.maxSlippageBps < 0) {
        errors.push({
          ...SECURITY_ERRORS.SLIPPAGE_EXCEEDED,
          message: 'Slippage BPS cannot be negative',
          details: { maxSlippageBps: params.maxSlippageBps }
        });
      }

      if (params.maxSlippageBps > 1000) { // 10% max
        errors.push({
          ...SECURITY_ERRORS.SLIPPAGE_EXCEEDED,
          message: 'Slippage BPS exceeds maximum allowed (1000 BPS / 10%)',
          details: { maxSlippageBps: params.maxSlippageBps, maxAllowed: 1000 }
        });
      }

      // Validate amounts
      if (params.returnAmount <= 0n) {
        errors.push({
          ...SECURITY_ERRORS.SLIPPAGE_EXCEEDED,
          message: 'Return amount must be positive',
          details: { returnAmount: params.returnAmount.toString() }
        });
      }

      if (params.executionAmount <= 0n) {
        errors.push({
          ...SECURITY_ERRORS.SLIPPAGE_EXCEEDED,
          message: 'Execution amount must be positive',
          details: { executionAmount: params.executionAmount.toString() }
        });
      }

      // Calculate actual slippage
      const calculatedSlippage = this.calculateActualSlippage(params.executionAmount, params.returnAmount);
      
      // Check if actual slippage exceeds specified limit
      if (calculatedSlippage > params.maxSlippageBps) {
        errors.push({
          ...SECURITY_ERRORS.SLIPPAGE_EXCEEDED,
          message: `Actual slippage (${calculatedSlippage} BPS) exceeds maximum allowed (${params.maxSlippageBps} BPS)`,
          details: {
            actualSlippage: calculatedSlippage,
            maxAllowed: params.maxSlippageBps,
            returnAmount: params.returnAmount.toString(),
            executionAmount: params.executionAmount.toString()
          }
        });
      }

      // Generate warnings for high slippage
      if (calculatedSlippage > 100 && calculatedSlippage <= params.maxSlippageBps) { // > 1%
        warnings.push(`High slippage detected: ${calculatedSlippage} BPS (${(calculatedSlippage / 100).toFixed(2)}%)`);
      }

      // Get recommended slippage based on market conditions
      const recommendedSlippage = await this.calculateRecommendedSlippage(params.executionAmount);

      if (params.maxSlippageBps < recommendedSlippage) {
        warnings.push(`Slippage tolerance (${params.maxSlippageBps} BPS) is below recommended (${recommendedSlippage} BPS) for current market conditions`);
      }

      return {
        isValid: errors.length === 0,
        calculatedSlippage,
        recommendedSlippage,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error('Failed to validate slippage parameters:', error);
      return {
        isValid: false,
        calculatedSlippage: 0,
        recommendedSlippage: 0,
        errors: [{
          code: 'SLIPPAGE_VALIDATION_FAILED',
          message: 'Internal error during slippage validation',
          details: { error: error instanceof Error ? error.message : String(error) },
          retryable: true
        }],
        warnings: []
      };
    }
  }

  /**
   * Enforces slippage limits before execution
   * Requirements: 7.2 - Slippage limit enforcement
   */
  async enforceSlippageLimit(params: SlippageParams): Promise<boolean> {
    try {
      const validation = await this.validateSlippageParameters(params);
      
      if (!validation.isValid) {
        this.logger.warn('Slippage limit enforcement failed:', validation.errors);
        return false;
      }

      // Additional enforcement: check against contract maximum
      const contractMaxSlippage = await this.contractService.getMaxSlippageBps();
      if (params.maxSlippageBps > Number(contractMaxSlippage)) {
        this.logger.warn(`Slippage ${params.maxSlippageBps} exceeds contract maximum ${contractMaxSlippage}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to enforce slippage limit:', error);
      return false;
    }
  }

  /**
   * Calculates dynamic slippage based on market conditions
   * Requirements: 7.4 - Dynamic slippage calculation
   */
  async calculateDynamicSlippage(
    executionAmount: bigint,
    marketConditions?: MarketCondition
  ): Promise<number> {
    try {
      const config = this.getSlippageConfig();
      
      // Get market conditions if not provided
      const conditions = marketConditions || await this.getMarketConditions(executionAmount);
      
      // Base slippage
      let dynamicSlippage = config.baseSlippageBps;
      
      // Adjust for volatility
      if (conditions.volatility > 5) { // > 5% volatility
        const volatilityAdjustment = (conditions.volatility - 5) * config.volatilityMultiplier;
        dynamicSlippage += Math.floor(volatilityAdjustment * 10); // Convert to BPS
      }
      
      // Adjust for liquidity
      if (conditions.liquidity < config.liquidityThreshold) {
        const liquidityRatio = conditions.liquidity / config.liquidityThreshold;
        const liquidityAdjustment = (1 - liquidityRatio) * 100; // Up to 100 BPS adjustment
        dynamicSlippage += Math.floor(liquidityAdjustment);
      }
      
      // Adjust for price impact
      if (conditions.priceImpact > 1) { // > 1% price impact
        const priceImpactAdjustment = conditions.priceImpact * 50; // 50 BPS per 1% price impact
        dynamicSlippage += Math.floor(priceImpactAdjustment);
      }
      
      // Cap at maximum
      return Math.min(dynamicSlippage, config.maxDynamicSlippageBps);
      
    } catch (error) {
      this.logger.error('Failed to calculate dynamic slippage:', error);
      return this.defaultConfig.baseSlippageBps;
    }
  }

  /**
   * Calculates recommended slippage for current market conditions
   */
  private async calculateRecommendedSlippage(executionAmount: bigint): Promise<number> {
    try {
      const marketConditions = await this.getMarketConditions(executionAmount);
      return this.calculateDynamicSlippage(executionAmount, marketConditions);
    } catch (error) {
      this.logger.error('Failed to calculate recommended slippage:', error);
      return this.defaultConfig.baseSlippageBps;
    }
  }

  /**
   * Calculates actual slippage between execution and return amounts
   */
  private calculateActualSlippage(executionAmount: bigint, returnAmount: bigint): number {
    if (executionAmount <= 0n) return 0;
    
    const difference = executionAmount - returnAmount;
    const slippageRatio = Number(difference * 10000n / executionAmount);
    
    return Math.max(0, slippageRatio); // Ensure non-negative
  }

  /**
   * Gets current market conditions for slippage calculation
   */
  private async getMarketConditions(executionAmount: bigint): Promise<MarketCondition> {
    try {
      // In a real implementation, this would fetch from price oracles, DEX APIs, etc.
      // For now, we'll use mock data based on execution amount
      
      const amountInEth = Number(executionAmount) / 1e18;
      
      // Simulate market conditions based on trade size
      let volatility = 2; // Base 2% volatility
      let liquidity = 1000000; // Base $1M liquidity
      let priceImpact = 0.1; // Base 0.1% price impact
      
      // Larger trades have higher impact
      if (amountInEth > 100) {
        volatility += 1;
        priceImpact += (amountInEth - 100) * 0.01;
      }
      
      if (amountInEth > 1000) {
        volatility += 2;
        liquidity *= 0.8; // Reduced effective liquidity for large trades
        priceImpact += (amountInEth - 1000) * 0.02;
      }
      
      return {
        volatility: Math.min(volatility, 20), // Cap at 20%
        liquidity: Math.max(liquidity, 50000), // Min $50k liquidity
        priceImpact: Math.min(priceImpact, 10) // Cap at 10%
      };
      
    } catch (error) {
      this.logger.error('Failed to get market conditions:', error);
      // Return conservative defaults
      return {
        volatility: 5,
        liquidity: 500000,
        priceImpact: 1
      };
    }
  }

  /**
   * Gets slippage configuration from config service
   */
  private getSlippageConfig(): DynamicSlippageConfig {
    return {
      baseSlippageBps: this.configService.get('slippage.baseSlippageBps', this.defaultConfig.baseSlippageBps),
      volatilityMultiplier: this.configService.get('slippage.volatilityMultiplier', this.defaultConfig.volatilityMultiplier),
      liquidityThreshold: this.configService.get('slippage.liquidityThreshold', this.defaultConfig.liquidityThreshold),
      maxDynamicSlippageBps: this.configService.get('slippage.maxDynamicSlippageBps', this.defaultConfig.maxDynamicSlippageBps),
    };
  }

  /**
   * Creates descriptive error messages for slippage violations
   * Requirements: 7.3 - Slippage error handling and messaging
   */
  createSlippageError(
    type: 'EXCEEDED' | 'INVALID_PARAMS' | 'CALCULATION_FAILED',
    details: Record<string, any>
  ): SecurityError {
    switch (type) {
      case 'EXCEEDED':
        return {
          code: 'SLIPPAGE_EXCEEDED',
          message: `Slippage protection triggered: actual slippage (${details.actualSlippage} BPS) exceeds limit (${details.maxSlippage} BPS)`,
          details,
          retryable: false,
          suggestedAction: 'Increase slippage tolerance or wait for better market conditions'
        };
      
      case 'INVALID_PARAMS':
        return {
          code: 'INVALID_SLIPPAGE_PARAMS',
          message: 'Invalid slippage parameters provided',
          details,
          retryable: false,
          suggestedAction: 'Check slippage parameters and ensure they are within valid ranges'
        };
      
      case 'CALCULATION_FAILED':
        return {
          code: 'SLIPPAGE_CALCULATION_FAILED',
          message: 'Failed to calculate slippage protection',
          details,
          retryable: true,
          suggestedAction: 'Retry the operation or use manual slippage settings'
        };
      
      default:
        return {
          code: 'UNKNOWN_SLIPPAGE_ERROR',
          message: 'Unknown slippage protection error',
          details,
          retryable: true
        };
    }
  }
}