import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { ContractService } from '../../shared/contract.service';

export interface ExecutionStep {
  stepId: number;
  action: 'bridge' | 'swap' | 'stake' | 'provide_liquidity' | 'claim_rewards';
  protocol: string;
  chain: string;
  tokenIn?: string;
  tokenOut?: string;
  amount: string;
  minAmountOut?: string;
  contractAddress?: string;
  callData?: string;
  estimatedGas: string;
  description: string;
}

export interface ExecutionPlan {
  intentId: number;
  steps: ExecutionStep[];
  totalSteps: number;
  estimatedDuration: number; // seconds
  estimatedGasCost: string;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

@Injectable()
export class ProtocolIntegrationService {
  private readonly logger = new Logger(ProtocolIntegrationService.name);

  // Protocol contract addresses on different chains
  private readonly PROTOCOL_ADDRESSES = {
    // Hydration (Parachain ID: 2034)
    hydration: {
      router: '0x0000000000000000000000000000000000000000', // Placeholder
      omnipool: '0x0000000000000000000000000000000000000001',
      staking: '0x0000000000000000000000000000000000000002',
    },
    // Bifrost (Parachain ID: 2030)
    bifrost: {
      liquidStaking: '0x0000000000000000000000000000000000000010',
      vTokenMinting: '0x0000000000000000000000000000000000000011',
      farming: '0x0000000000000000000000000000000000000012',
    },
    // Moonbeam (Parachain ID: 2004)
    moonbeam: {
      stellaswap: '0x0000000000000000000000000000000000000020',
      beamswap: '0x0000000000000000000000000000000000000021',
      solarflare: '0x0000000000000000000000000000000000000022',
    },
  };

  // Standard ERC20 ABI for token operations
  private readonly ERC20_ABI = [
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)',
  ];

  constructor(
    private configService: ConfigService,
    private contractService: ContractService,
  ) {}

  async generateExecutionPlan(intent: any): Promise<ExecutionPlan> {
    try {
      this.logger.log(`Generating execution plan for intent ${intent.user}`);

      // Parse intent parameters (in production, this would be more sophisticated)
      const amount = ethers.formatEther(intent.amount);
      const asset = 'DOT'; // Assume DOT for now
      
      // Determine strategy based on intent goal
      const strategy = await this.determineStrategy(intent);
      
      // Generate steps based on strategy
      const steps = await this.generateSteps(strategy, asset, amount);
      
      // Calculate estimates
      const totalGasCost = steps.reduce((sum, step) => 
        sum + BigInt(step.estimatedGas), BigInt(0)
      );
      
      const estimatedDuration = steps.length * 30; // 30 seconds per step average

      return {
        intentId: Number(intent.user), // Temporary - should be actual intent ID
        steps,
        totalSteps: steps.length,
        estimatedDuration,
        estimatedGasCost: totalGasCost.toString(),
        riskLevel: this.calculateRiskLevel(strategy),
        description: `Execute ${strategy.name} strategy for ${amount} ${asset}`,
      };

    } catch (error) {
      this.logger.error('Failed to generate execution plan:', error);
      throw error;
    }
  }

  private async determineStrategy(intent: any): Promise<{
    name: string;
    type: 'liquid_staking' | 'yield_farming' | 'arbitrage';
    protocols: string[];
    chains: string[];
  }> {
    // Simple strategy determination (in production, use AI/ML)
    // For now, default to liquid staking on Bifrost
    
    return {
      name: 'Bifrost Liquid Staking',
      type: 'liquid_staking',
      protocols: ['bifrost'],
      chains: ['bifrost'],
    };
  }

  private async generateSteps(strategy: any, asset: string, amount: string): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];

    switch (strategy.type) {
      case 'liquid_staking':
        steps.push(...await this.generateLiquidStakingSteps(asset, amount));
        break;
      case 'yield_farming':
        steps.push(...await this.generateYieldFarmingSteps(asset, amount));
        break;
      case 'arbitrage':
        steps.push(...await this.generateArbitrageSteps(asset, amount));
        break;
    }

    return steps;
  }

  private async generateLiquidStakingSteps(asset: string, amount: string): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];

    // Step 1: Bridge to Bifrost (if not already there)
    steps.push({
      stepId: 1,
      action: 'bridge',
      protocol: 'XCM',
      chain: 'bifrost',
      tokenIn: asset,
      amount,
      contractAddress: '0x0000000000000000000000000000000000000a00', // XCM Precompile
      callData: await this.buildXCMBridgeCallData('bifrost', asset, amount),
      estimatedGas: '200000',
      description: `Bridge ${amount} ${asset} to Bifrost parachain`,
    });

    // Step 2: Liquid stake on Bifrost
    steps.push({
      stepId: 2,
      action: 'stake',
      protocol: 'Bifrost',
      chain: 'bifrost',
      tokenIn: asset,
      tokenOut: `v${asset}`,
      amount,
      contractAddress: this.PROTOCOL_ADDRESSES.bifrost.liquidStaking,
      callData: await this.buildLiquidStakeCallData(asset, amount),
      estimatedGas: '150000',
      description: `Liquid stake ${amount} ${asset} to receive v${asset}`,
    });

    return steps;
  }

  private async generateYieldFarmingSteps(asset: string, amount: string): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];

    // Step 1: Bridge to Hydration
    steps.push({
      stepId: 1,
      action: 'bridge',
      protocol: 'XCM',
      chain: 'hydration',
      tokenIn: asset,
      amount,
      contractAddress: '0x0000000000000000000000000000000000000a00',
      callData: await this.buildXCMBridgeCallData('hydration', asset, amount),
      estimatedGas: '200000',
      description: `Bridge ${amount} ${asset} to Hydration parachain`,
    });

    // Step 2: Swap half to USDT (for LP)
    const halfAmount = (parseFloat(amount) / 2).toString();
    steps.push({
      stepId: 2,
      action: 'swap',
      protocol: 'Hydration',
      chain: 'hydration',
      tokenIn: asset,
      tokenOut: 'USDT',
      amount: halfAmount,
      minAmountOut: (parseFloat(halfAmount) * 0.995).toString(), // 0.5% slippage
      contractAddress: this.PROTOCOL_ADDRESSES.hydration.router,
      callData: await this.buildSwapCallData(asset, 'USDT', halfAmount),
      estimatedGas: '180000',
      description: `Swap ${halfAmount} ${asset} to USDT`,
    });

    // Step 3: Provide liquidity
    steps.push({
      stepId: 3,
      action: 'provide_liquidity',
      protocol: 'Hydration',
      chain: 'hydration',
      tokenIn: asset,
      tokenOut: 'USDT',
      amount: halfAmount,
      contractAddress: this.PROTOCOL_ADDRESSES.hydration.omnipool,
      callData: await this.buildAddLiquidityCallData(asset, 'USDT', halfAmount),
      estimatedGas: '220000',
      description: `Add ${halfAmount} ${asset} and USDT to liquidity pool`,
    });

    return steps;
  }

  private async generateArbitrageSteps(asset: string, amount: string): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];

    // Simple arbitrage: DOT -> USDT -> DOT across different DEXs
    // This is a simplified example

    // Step 1: Swap DOT to USDT on Hydration
    steps.push({
      stepId: 1,
      action: 'swap',
      protocol: 'Hydration',
      chain: 'hydration',
      tokenIn: asset,
      tokenOut: 'USDT',
      amount,
      contractAddress: this.PROTOCOL_ADDRESSES.hydration.router,
      callData: await this.buildSwapCallData(asset, 'USDT', amount),
      estimatedGas: '180000',
      description: `Swap ${amount} ${asset} to USDT on Hydration`,
    });

    // Step 2: Bridge USDT to Moonbeam
    steps.push({
      stepId: 2,
      action: 'bridge',
      protocol: 'XCM',
      chain: 'moonbeam',
      tokenIn: 'USDT',
      amount: (parseFloat(amount) * 10).toString(), // Assume 1 DOT = 10 USDT
      contractAddress: '0x0000000000000000000000000000000000000a00',
      callData: await this.buildXCMBridgeCallData('moonbeam', 'USDT', amount),
      estimatedGas: '200000',
      description: `Bridge USDT to Moonbeam`,
    });

    // Step 3: Swap USDT back to DOT on StellaSwap (hopefully at better rate)
    steps.push({
      stepId: 3,
      action: 'swap',
      protocol: 'StellaSwap',
      chain: 'moonbeam',
      tokenIn: 'USDT',
      tokenOut: asset,
      amount: (parseFloat(amount) * 10).toString(),
      contractAddress: this.PROTOCOL_ADDRESSES.moonbeam.stellaswap,
      callData: await this.buildSwapCallData('USDT', asset, amount),
      estimatedGas: '180000',
      description: `Swap USDT back to ${asset} on StellaSwap`,
    });

    return steps;
  }

  // Call data builders for different protocols
  private async buildXCMBridgeCallData(targetChain: string, asset: string, amount: string): Promise<string> {
    // Build XCM message for cross-chain transfer
    const paraIds: Record<string, number> = {
      hydration: 2034,
      bifrost: 2030,
      moonbeam: 2004,
    };

    const paraId = paraIds[targetChain];
    if (!paraId) {
      throw new Error(`Unsupported target chain: ${targetChain}`);
    }

    // This would build actual XCM call data
    // For now, return placeholder
    return ethers.solidityPacked(
      ['uint32', 'uint256'],
      [paraId, ethers.parseEther(amount)]
    );
  }

  private async buildLiquidStakeCallData(asset: string, amount: string): Promise<string> {
    // Build call data for liquid staking
    // This would interact with Bifrost's vToken minting contract
    
    const iface = new ethers.Interface([
      'function mint(uint256 amount) external returns (uint256)'
    ]);

    return iface.encodeFunctionData('mint', [ethers.parseEther(amount)]);
  }

  private async buildSwapCallData(tokenIn: string, tokenOut: string, amount: string): Promise<string> {
    // Build call data for token swap
    const iface = new ethers.Interface([
      'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)'
    ]);

    const path = [this.getTokenAddress(tokenIn), this.getTokenAddress(tokenOut)];
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
    const amountOutMin = ethers.parseEther((parseFloat(amount) * 0.995).toString()); // 0.5% slippage

    return iface.encodeFunctionData('swapExactTokensForTokens', [
      ethers.parseEther(amount),
      amountOutMin,
      path,
      '0x0000000000000000000000000000000000000000', // Will be replaced with actual recipient
      deadline
    ]);
  }

  private async buildAddLiquidityCallData(tokenA: string, tokenB: string, amount: string): Promise<string> {
    // Build call data for adding liquidity
    const iface = new ethers.Interface([
      'function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)'
    ]);

    const deadline = Math.floor(Date.now() / 1000) + 1800;
    const amountDesired = ethers.parseEther(amount);
    const amountMin = amountDesired * BigInt(95) / BigInt(100); // 5% slippage

    return iface.encodeFunctionData('addLiquidity', [
      this.getTokenAddress(tokenA),
      this.getTokenAddress(tokenB),
      amountDesired,
      amountDesired, // Assume 1:1 ratio for simplicity
      amountMin,
      amountMin,
      '0x0000000000000000000000000000000000000000', // Will be replaced
      deadline
    ]);
  }

  private getTokenAddress(symbol: string): string {
    // Map token symbols to addresses
    const tokenAddresses: Record<string, string> = {
      DOT: '0x0000000000000000000000000000000000000100',
      USDT: '0x0000000000000000000000000000000000000101',
      vDOT: '0x0000000000000000000000000000000000000102',
      // Add more tokens as needed
    };

    return tokenAddresses[symbol] || '0x0000000000000000000000000000000000000000';
  }

  private calculateRiskLevel(strategy: any): 'low' | 'medium' | 'high' {
    switch (strategy.type) {
      case 'liquid_staking':
        return 'low';
      case 'yield_farming':
        return 'medium';
      case 'arbitrage':
        return 'high';
      default:
        return 'medium';
    }
  }

  // Protocol-specific integration methods
  async getHydrationPools(): Promise<any[]> {
    try {
      // In production, this would call Hydration's API or on-chain data
      return [
        {
          id: 'DOT-USDT',
          tokenA: 'DOT',
          tokenB: 'USDT',
          apy: 12.5,
          tvl: 50000000,
          fee: 0.3,
        },
        {
          id: 'DOT-GLMR',
          tokenA: 'DOT',
          tokenB: 'GLMR',
          apy: 15.2,
          tvl: 25000000,
          fee: 0.3,
        },
      ];
    } catch (error) {
      this.logger.error('Failed to get Hydration pools:', error);
      return [];
    }
  }

  async getBifrostStakingInfo(): Promise<any> {
    try {
      // In production, this would call Bifrost's API
      return {
        apy: 8.5,
        exchangeRate: 1.05, // 1 DOT = 1.05 vDOT
        totalStaked: 1000000,
        unbondingPeriod: 28, // days
      };
    } catch (error) {
      this.logger.error('Failed to get Bifrost staking info:', error);
      return null;
    }
  }

  async getMoonbeamDexInfo(): Promise<any[]> {
    try {
      // In production, this would aggregate data from multiple DEXs
      return [
        {
          name: 'StellaSwap',
          pairs: ['DOT-USDT', 'DOT-GLMR'],
          totalTvl: 15000000,
        },
        {
          name: 'BeamSwap',
          pairs: ['DOT-USDT', 'DOT-MOVR'],
          totalTvl: 8000000,
        },
      ];
    } catch (error) {
      this.logger.error('Failed to get Moonbeam DEX info:', error);
      return [];
    }
  }

  // Validation methods
  async validateExecutionStep(step: ExecutionStep): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate step structure
    if (!step.action || !step.protocol || !step.chain) {
      errors.push('Missing required step fields');
    }

    // Validate amounts
    if (step.amount && parseFloat(step.amount) <= 0) {
      errors.push('Invalid amount');
    }

    // Validate contract address
    if (step.contractAddress && !ethers.isAddress(step.contractAddress)) {
      errors.push('Invalid contract address');
    }

    // Validate gas estimate
    if (step.estimatedGas && parseInt(step.estimatedGas) > 1000000) {
      warnings.push('High gas estimate - execution may be expensive');
    }

    // Protocol-specific validations
    switch (step.protocol.toLowerCase()) {
      case 'hydration':
        if (!this.PROTOCOL_ADDRESSES.hydration.router) {
          errors.push('Hydration router address not configured');
        }
        break;
      case 'bifrost':
        if (!this.PROTOCOL_ADDRESSES.bifrost.liquidStaking) {
          errors.push('Bifrost liquid staking address not configured');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async estimateExecutionCost(steps: ExecutionStep[]): Promise<{
    totalGasCost: string;
    totalTimeEstimate: number;
    riskAssessment: string;
  }> {
    const totalGas = steps.reduce((sum, step) => sum + BigInt(step.estimatedGas), BigInt(0));
    const totalTime = steps.length * 30; // 30 seconds per step average
    
    // Simple risk assessment
    let riskScore = 0;
    for (const step of steps) {
      switch (step.action) {
        case 'bridge': riskScore += 2; break;
        case 'swap': riskScore += 1; break;
        case 'stake': riskScore += 1; break;
        case 'provide_liquidity': riskScore += 3; break;
      }
    }

    const riskLevel = riskScore <= 3 ? 'low' : riskScore <= 6 ? 'medium' : 'high';

    return {
      totalGasCost: totalGas.toString(),
      totalTimeEstimate: totalTime,
      riskAssessment: riskLevel,
    };
  }
}