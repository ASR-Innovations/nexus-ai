import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService, CacheKeys } from '../shared/cache.service';
import { CircuitBreakerService } from '../shared/circuit-breaker.service';
import { ContractService } from '../shared/contract.service';
import { IntentParams, Strategy, ExecutionPlan } from '../shared/types';
import { YieldData } from './strategy.dto';

export interface StrategyComputeResult {
  strategies: Strategy[];
  usedFallbackData: boolean;
  fallbackSources: string[];
}

@Injectable()
export class StrategyService {
  private readonly logger = new Logger(StrategyService.name);

  constructor(
    private configService: ConfigService,
    private cacheService: CacheService,
    private circuitBreakerService: CircuitBreakerService,
    private contractService: ContractService,
  ) {}

  async computeStrategies(intentParams: IntentParams): Promise<StrategyComputeResult> {
    try {
      this.logger.log(`Computing strategies for ${intentParams.action} ${intentParams.amount} ${intentParams.asset}`);

      // Get yield data from various sources
      const { yieldData, usedFallback, fallbackSources } = await this.aggregateYieldData(intentParams.asset);
      
      // Filter and rank strategies based on intent parameters
      const strategies = await this.filterAndRankStrategies(yieldData, intentParams);
      
      // Limit to top 3 strategies
      const maxResults = this.configService.get('STRATEGY_MAX_RESULTS', 3);
      
      return {
        strategies: strategies.slice(0, maxResults),
        usedFallbackData: usedFallback,
        fallbackSources,
      };

    } catch (error) {
      this.logger.error('Failed to compute strategies:', error);
      return {
        strategies: [],
        usedFallbackData: true,
        fallbackSources: ['error'],
      };
    }
  }

  private async aggregateYieldData(asset: string): Promise<{
    yieldData: YieldData[];
    usedFallback: boolean;
    fallbackSources: string[];
  }> {
    const cacheKey = CacheKeys.yieldData(asset);
    
    const result = await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const yieldData: YieldData[] = [];
        const fallbackSources: string[] = [];

        // Fetch from multiple sources in parallel
        const [hydrationData, bifrostData, moonbeamData] = await Promise.allSettled([
          this.getHydrationYieldData(asset),
          this.getBifrostYieldData(asset),
          this.getMoonbeamYieldData(asset),
        ]);

        // Track which sources used fallback
        if (hydrationData.status === 'fulfilled') {
          yieldData.push(...hydrationData.value.data);
          if (hydrationData.value.usedFallback) {
            fallbackSources.push('Hydration');
          }
        } else {
          fallbackSources.push('Hydration');
        }

        if (bifrostData.status === 'fulfilled') {
          yieldData.push(...bifrostData.value.data);
          if (bifrostData.value.usedFallback) {
            fallbackSources.push('Bifrost');
          }
        } else {
          fallbackSources.push('Bifrost');
        }

        if (moonbeamData.status === 'fulfilled') {
          yieldData.push(...moonbeamData.value.data);
          if (moonbeamData.value.usedFallback) {
            fallbackSources.push('Moonbeam');
          }
        } else {
          fallbackSources.push('Moonbeam');
        }

        // If no real data, return mock data for development
        if (yieldData.length === 0) {
          return {
            yieldData: this.getMockYieldData(asset),
            usedFallback: true,
            fallbackSources: ['all'],
          };
        }

        return {
          yieldData,
          usedFallback: fallbackSources.length > 0,
          fallbackSources,
        };
      },
      { ttl: this.configService.get('CACHE_YIELD_DATA_TTL', 120) }
    );
    
    return result;
  }

  private async getHydrationYieldData(asset: string): Promise<{
    data: YieldData[];
    usedFallback: boolean;
  }> {
    const mockExternalApis = this.configService.get<boolean>('app.development.mockExternalApis', false);
    if (mockExternalApis) {
      return { data: this.getMockHydrationData(asset), usedFallback: true };
    }

    if (asset.toLowerCase() !== 'dot' && asset.toLowerCase() !== 'pas') {
      return { data: [], usedFallback: false };
    }

    if (asset.toLowerCase() === 'pas') {
      return this.getPasAgentStrategies(asset, 'conservative');
    }

    // Use circuit breaker for API call
    const result = await this.circuitBreakerService.executeWithFallback(
      'hydration-api',
      async () => {
        const response = await fetch('https://api.hydradx.io/hydradx-ui/v2/stats/pools', {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          throw new Error(`Hydration API returned ${response.status}`);
        }

        const pools = await response.json() as any[];
        const dotPools = pools.filter((p: any) =>
          p.assetASymbol === 'DOT' || p.assetBSymbol === 'DOT'
        );

        if (dotPools.length === 0) {
          throw new Error('No DOT pools found in Hydration response');
        }

        return dotPools.map((pool: any) => ({
          protocol: 'Hydration Omnipool',
          chain: 'Hydration',
          asset: 'DOT',
          apyBps: Math.round((parseFloat(pool.apr || pool.apy || '0') * 100)),
          tvlUsd: parseFloat(pool.tvl || pool.tvlUsd || '0'),
          lockDays: 0,
          riskLevel: 'medium' as const,
          auditStatus: 'audited' as const,
          lastUpdated: Date.now(),
        })).filter((d: YieldData) => d.apyBps > 0);
      },
      this.getMockHydrationData(asset),
      {
        failureThreshold: 3,
        timeout: 30000,
      }
    );

    if (result.usedFallback) {
      this.logger.warn('Using fallback data for Hydration - API unavailable or circuit open');
    }

    return {
      data: result.value,
      usedFallback: result.usedFallback,
    };
  }

  private async getPasAgentStrategies(
    asset: string,
    tier: 'conservative' | 'liquid-staking' | 'high-yield',
  ): Promise<{ data: YieldData[]; usedFallback: boolean }> {
    const PASEO_CHAIN = 'Polkadot Hub Testnet (Paseo)';
    const tierConfig: Record<string, { apyBps: number; lockDays: number; riskLevel: 'low' | 'medium' | 'high'; name: string }> = {
      'conservative': { apyBps: 800,  lockDays: 0,  riskLevel: 'low',    name: 'Conservative Yield Agent' },
      'liquid-staking': { apyBps: 1000, lockDays: 14, riskLevel: 'low',    name: 'Liquid Staking Agent' },
      'high-yield':   { apyBps: 1500, lockDays: 0,  riskLevel: 'medium', name: 'High Yield Agent' },
    };
    const cfg = tierConfig[tier];

    try {
      const agentRegistry = this.contractService.getAgentRegistryContract();
      const topAddresses: string[] = await agentRegistry.getTopAgents(5);

      const agentData: Array<{
        stakeAmount: bigint; reputationScore: bigint;
        successCount: bigint; failCount: bigint;
        totalExecutions: bigint; isActive: boolean;
      }> = [];

      for (const addr of topAddresses) {
        try {
          const a = await agentRegistry.getAgent(addr);
          if (a.isActive) agentData.push(a);
        } catch { /* skip inactive/errored agents */ }
      }

      if (agentData.length === 0) {
        throw new Error('No active agents found');
      }

      // Pick agent most suited for this tier (highest success rate)
      const best = agentData.sort((a, b) => {
        const rateA = Number(a.totalExecutions) > 0 ? Number(a.successCount) / Number(a.totalExecutions) : 0;
        const rateB = Number(b.totalExecutions) > 0 ? Number(b.successCount) / Number(b.totalExecutions) : 0;
        return rateB - rateA;
      })[0];

      const reputationScore = Number(best.reputationScore);
      // Adjust APY slightly based on real reputation (±20%)
      const reputationMultiplier = Math.min(1.2, Math.max(0.8, reputationScore / 1000));
      const adjustedApyBps = Math.round(cfg.apyBps * reputationMultiplier);
      const stakeUsd = Number(best.stakeAmount) / 1e18 * 10; // rough $10/PAS

      return {
        data: [{
          protocol: cfg.name,
          chain: PASEO_CHAIN,
          asset: asset.toUpperCase(),
          apyBps: adjustedApyBps,
          tvlUsd: stakeUsd,
          lockDays: cfg.lockDays,
          riskLevel: cfg.riskLevel,
          auditStatus: 'audited',
          lastUpdated: Date.now(),
        }],
        usedFallback: false,
      };
    } catch (err) {
      this.logger.warn(`AgentRegistry query failed for ${tier} strategy, using mock:`, err);
      return {
        data: [{
          protocol: cfg.name,
          chain: PASEO_CHAIN,
          asset: asset.toUpperCase(),
          apyBps: cfg.apyBps,
          tvlUsd: 0,
          lockDays: cfg.lockDays,
          riskLevel: cfg.riskLevel,
          auditStatus: 'audited',
          lastUpdated: Date.now(),
        }],
        usedFallback: true,
      };
    }
  }

  private getMockHydrationData(asset: string): YieldData[] {
    const a = asset.toLowerCase();
    if (a === 'dot' || a === 'pas') {
      return [
        {
          protocol: 'Hydration',
          chain: 'Hydration',
          asset: asset.toUpperCase(),
          apyBps: 1200, // 12% APY
          tvlUsd: 50_000_000,
          lockDays: 0,
          riskLevel: 'medium',
          auditStatus: 'audited',
          lastUpdated: Date.now(),
        },
        {
          protocol: 'Hydration Omnipool',
          chain: 'Hydration',
          asset: asset.toUpperCase(),
          apyBps: 1500, // 15% APY
          tvlUsd: 25_000_000,
          lockDays: 0,
          riskLevel: 'high',
          auditStatus: 'audited',
          lastUpdated: Date.now(),
        },
      ];
    }
    return [];
  }

  private async getBifrostYieldData(asset: string): Promise<{
    data: YieldData[];
    usedFallback: boolean;
  }> {
    const mockExternalApis = this.configService.get<boolean>('app.development.mockExternalApis', false);
    if (mockExternalApis) {
      return { data: this.getMockBifrostData(asset), usedFallback: true };
    }

    if (asset.toLowerCase() !== 'dot' && asset.toLowerCase() !== 'pas') {
      return { data: [], usedFallback: false };
    }

    if (asset.toLowerCase() === 'pas') {
      return this.getPasAgentStrategies(asset, 'liquid-staking');
    }

    // Use circuit breaker for API call
    const result = await this.circuitBreakerService.executeWithFallback(
      'bifrost-api',
      async () => {
        const response = await fetch('https://api.bifrost.app/api/dapp/vsDOT', {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          throw new Error(`Bifrost API returned ${response.status}`);
        }

        const data = await response.json() as any;
        const apyBps = Math.round(parseFloat(data?.apy || data?.annualizedYield || '0') * 100);

        if (apyBps === 0) {
          throw new Error('No valid APY data from Bifrost');
        }

        return [{
          protocol: 'Bifrost Liquid Staking',
          chain: 'Bifrost',
          asset: 'DOT',
          apyBps,
          tvlUsd: parseFloat(data?.tvl || '0'),
          lockDays: 28,
          riskLevel: 'low' as const,
          auditStatus: 'audited' as const,
          lastUpdated: Date.now(),
        }];
      },
      this.getMockBifrostData(asset),
      {
        failureThreshold: 3,
        timeout: 30000,
      }
    );

    if (result.usedFallback) {
      this.logger.warn('Using fallback data for Bifrost - API unavailable or circuit open');
    }

    return {
      data: result.value,
      usedFallback: result.usedFallback,
    };
  }

  private getMockBifrostData(asset: string): YieldData[] {
    const a = asset.toLowerCase();
    if (a === 'dot' || a === 'pas') {
      return [
        {
          protocol: 'Bifrost Liquid Staking',
          chain: 'Bifrost',
          asset: asset.toUpperCase(),
          apyBps: 800, // 8% APY
          tvlUsd: 100_000_000,
          lockDays: 28,
          riskLevel: 'low',
          auditStatus: 'audited',
          lastUpdated: Date.now(),
        },
      ];
    }
    return [];
  }

  private async getMoonbeamYieldData(asset: string): Promise<{
    data: YieldData[];
    usedFallback: boolean;
  }> {
    const mockExternalApis = this.configService.get<boolean>('app.development.mockExternalApis', false);
    if (mockExternalApis) {
      return { data: this.getMockMoonbeamData(asset), usedFallback: true };
    }

    if (asset.toLowerCase() !== 'dot' && asset.toLowerCase() !== 'pas') {
      return { data: [], usedFallback: false };
    }

    if (asset.toLowerCase() === 'pas') {
      return this.getPasAgentStrategies(asset, 'high-yield');
    }

    // Use circuit breaker for API call
    const result = await this.circuitBreakerService.executeWithFallback(
      'stellaswap-api',
      async () => {
        const response = await fetch('https://api-v2.stellaswap.com/api/v2/pulsar/allPools', {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          throw new Error(`StellaSwap API returned ${response.status}`);
        }

        const data = await response.json() as any;
        const pools: any[] = data?.data || data?.pools || [];
        const dotPools = pools.filter((p: any) =>
          (p.token0Symbol === 'xcDOT' || p.token1Symbol === 'xcDOT' ||
           p.token0Symbol === 'DOT' || p.token1Symbol === 'DOT')
        );

        if (dotPools.length === 0) {
          throw new Error('No DOT pools found in StellaSwap response');
        }

        return dotPools.map((pool: any) => ({
          protocol: 'StellaSwap',
          chain: 'Moonbeam',
          asset: 'DOT',
          apyBps: Math.round(parseFloat(pool.apr || pool.apy || '0') * 100),
          tvlUsd: parseFloat(pool.tvlUSD || pool.tvl || '0'),
          lockDays: 7,
          riskLevel: 'medium' as const,
          auditStatus: 'partial' as const,
          lastUpdated: Date.now(),
        })).filter((d: YieldData) => d.apyBps > 0);
      },
      this.getMockMoonbeamData(asset),
      {
        failureThreshold: 3,
        timeout: 30000,
      }
    );

    if (result.usedFallback) {
      this.logger.warn('Using fallback data for StellaSwap - API unavailable or circuit open');
    }

    return {
      data: result.value,
      usedFallback: result.usedFallback,
    };
  }

  private getMockMoonbeamData(asset: string): YieldData[] {
    const a = asset.toLowerCase();
    if (a === 'dot' || a === 'pas') {
      return [
        {
          protocol: 'StellaSwap',
          chain: 'Moonbeam',
          asset: asset.toUpperCase(),
          apyBps: 1000, // 10% APY
          tvlUsd: 15_000_000,
          lockDays: 7,
          riskLevel: 'medium',
          auditStatus: 'partial',
          lastUpdated: Date.now(),
        },
      ];
    }
    return [];
  }

  private getMockYieldData(asset: string): YieldData[] {
    const a = asset.toLowerCase();
    if (a === 'dot' || a === 'pas') {
      const sym = asset.toUpperCase();
      return [
        {
          protocol: 'Hydration',
          chain: 'Hydration',
          asset: sym,
          apyBps: 1200,
          tvlUsd: 50_000_000,
          lockDays: 0,
          riskLevel: 'medium',
          auditStatus: 'audited',
          lastUpdated: Date.now(),
        },
        {
          protocol: 'Bifrost Liquid Staking',
          chain: 'Bifrost',
          asset: sym,
          apyBps: 800,
          tvlUsd: 100_000_000,
          lockDays: 28,
          riskLevel: 'low',
          auditStatus: 'audited',
          lastUpdated: Date.now(),
        },
        {
          protocol: 'StellaSwap',
          chain: 'Moonbeam',
          asset: sym,
          apyBps: 1000,
          tvlUsd: 15_000_000,
          lockDays: 7,
          riskLevel: 'medium',
          auditStatus: 'partial',
          lastUpdated: Date.now(),
        },
      ];
    }
    return [];
  }

  private async filterAndRankStrategies(yieldData: YieldData[], intentParams: IntentParams): Promise<Strategy[]> {
    const strategies: Strategy[] = [];

    for (const data of yieldData) {
      // Filter by risk tolerance
      if (!this.matchesRiskTolerance(data.riskLevel, intentParams.riskTolerance)) {
        continue;
      }

      // Filter by minimum yield
      if (intentParams.minYieldBps && data.apyBps < intentParams.minYieldBps) {
        continue;
      }

      // Filter by maximum lock period
      if (intentParams.maxLockDays && data.lockDays > intentParams.maxLockDays) {
        continue;
      }

      // Calculate risk score
      const riskScore = this.calculateRiskScore(data);

      // Calculate net APY after estimated gas costs
      const gasEstimateUsd = this.estimateGasCosts(data.protocol, data.chain);
      const amountUsd = parseFloat(intentParams.amount) * 10; // Assume $10 per DOT
      const netApyBps = this.calculateNetApy(data.apyBps, gasEstimateUsd, amountUsd);

      const strategy: Strategy = {
        name: `${data.protocol} ${data.asset} Yield`,
        protocol: data.protocol,
        chain: data.chain,
        estimatedApyBps: data.apyBps,
        netApyBps,
        lockDays: data.lockDays,
        riskLevel: data.riskLevel,
        riskScore,
        sharpeRatio: this.calculateSharpeRatio(data.apyBps, riskScore),
        pros: this.generatePros(data),
        cons: this.generateCons(data),
        explanation: '', // Will be filled by AI later
        executionPlan: this.generateExecutionPlan(data),
        estimatedGasUsd: gasEstimateUsd,
      };

      strategies.push(strategy);
      this.logger.log(`Added strategy: ${strategy.name} (Net APY: ${strategy.netApyBps} bps)`);
    }

    this.logger.log(`Final strategies count: ${strategies.length}`);
    return strategies.sort((a, b) => {
      if (b.netApyBps !== a.netApyBps) {
        return b.netApyBps - a.netApyBps;
      }
      return a.riskScore - b.riskScore;
    });
  }

  private matchesRiskTolerance(dataRisk: string, userRisk: string): boolean {
    const riskLevels: Record<string, number> = { low: 1, medium: 2, high: 3 };
    return riskLevels[dataRisk] <= riskLevels[userRisk];
  }

  private calculateRiskScore(data: YieldData): number {
    let score = 0;

    // Audit status risk
    switch (data.auditStatus) {
      case 'audited': score += 10; break;
      case 'partial': score += 30; break;
      case 'unaudited': score += 60; break;
    }

    // Lock period risk
    if (data.lockDays === 0) score += 5;
    else if (data.lockDays < 7) score += 15;
    else if (data.lockDays < 28) score += 30;
    else score += 50;

    // TVL risk (lower TVL = higher risk)
    if (data.tvlUsd > 100_000_000) score += 5;
    else if (data.tvlUsd > 10_000_000) score += 15;
    else if (data.tvlUsd > 1_000_000) score += 30;
    else score += 60;

    return Math.min(score / 3, 100); // Average and cap at 100
  }

  private estimateGasCosts(_protocol: string, chain: string): number {
    // Rough gas cost estimates in USD
    const gasEstimates: Record<string, number> = {
      'Hydration': 2,
      'Bifrost': 3,
      'Moonbeam': 5,
      'Polkadot Hub Testnet (Paseo)': 1,
    };
    return gasEstimates[chain] ?? 5;
  }

  private calculateNetApy(grossApyBps: number, gasUsd: number, amountUsd: number): number {
    const annualGasCost = gasUsd * 4; // Assume 4 transactions per year
    const gasCostBps = (annualGasCost / amountUsd) * 10000;
    return Math.max(0, grossApyBps - gasCostBps);
  }

  private generateExecutionSteps(data: YieldData): string[] {
    const steps = [
      `Bridge ${data.asset} to ${data.chain}`,
      `Connect to ${data.protocol}`,
      `Deposit ${data.asset} into yield strategy`,
    ];

    if (data.lockDays > 0) {
      steps.push(`Lock tokens for ${data.lockDays} days`);
    }

    steps.push('Monitor position and claim rewards');
    return steps;
  }

  private generateRequirements(data: YieldData): string[] {
    const requirements = [
      `Minimum ${data.asset} balance for gas fees`,
      `Wallet compatible with ${data.chain}`,
    ];

    if (data.lockDays > 0) {
      requirements.push(`Commitment to ${data.lockDays}-day lock period`);
    }

    return requirements;
  }

  private calculateSharpeRatio(apyBps: number, riskScore: number): number {
    // Simplified Sharpe ratio calculation
    // Assume risk-free rate of 3% (300 bps)
    const riskFreeRate = 300;
    const excessReturn = apyBps - riskFreeRate;
    const volatility = riskScore * 10; // Convert risk score to volatility estimate
    return volatility > 0 ? excessReturn / volatility : 0;
  }

  private generatePros(data: YieldData): string[] {
    const pros = [];
    
    if (data.apyBps > 1000) {
      pros.push(`High yield potential: ${(data.apyBps / 100).toFixed(1)}% APY`);
    }
    
    if (data.auditStatus === 'audited') {
      pros.push('Audited smart contracts');
    }
    
    if (data.tvlUsd > 50_000_000) {
      pros.push('High TVL indicates strong community trust');
    }
    
    if (data.lockDays === 0) {
      pros.push('No lock period - maintain liquidity');
    }
    
    if (data.riskLevel === 'low') {
      pros.push('Low risk strategy suitable for conservative investors');
    }
    
    return pros.length > 0 ? pros : ['Established protocol with yield opportunities'];
  }

  private generateCons(data: YieldData): string[] {
    const cons = [];
    
    if (data.riskLevel === 'high') {
      cons.push('High risk - potential for significant losses');
    }
    
    if (data.auditStatus !== 'audited') {
      cons.push('Limited or no audit coverage');
    }
    
    if (data.lockDays > 0) {
      cons.push(`Funds locked for ${data.lockDays} days`);
    }
    
    if (data.tvlUsd < 10_000_000) {
      cons.push('Lower TVL may indicate liquidity risks');
    }
    
    if (data.apyBps < 500) {
      cons.push('Relatively low yield compared to alternatives');
    }
    
    return cons.length > 0 ? cons : ['Standard DeFi risks apply'];
  }

  private generateExecutionPlan(data: YieldData): ExecutionPlan {
    const steps = [];
    
    // Step 1: Bridge to target chain (if needed — not required for Paseo-native strategies)
    const isPaseo = data.chain === 'Polkadot Hub Testnet (Paseo)' || data.chain === 'Polkadot Hub';
    if (!isPaseo) {
      steps.push({
        destinationParaId: this.getParaId(data.chain),
        targetContract: '0x0000000000000000000000000000000000000000', // XCM precompile
        callData: '0x', // Will be generated during execution
        value: '0',
      });
    }
    
    // Step 2: Interact with protocol
    steps.push({
      destinationParaId: this.getParaId(data.chain),
      targetContract: '0x0000000000000000000000000000000000000001', // Protocol contract
      callData: '0x', // Will be generated during execution
      value: '0',
    });
    
    return {
      steps,
      totalSteps: steps.length,
      estimatedGas: '500000',
      description: `Execute ${data.protocol} yield strategy on ${data.chain}`,
    };
  }

  private getParaId(chain: string): number {
    const paraIds: Record<string, number> = {
      'Hydration': 2034,
      'Bifrost': 2030,
      'Moonbeam': 2004,
      'Polkadot Hub': 1000,
      'Polkadot Hub Testnet (Paseo)': 1000,
    };
    return paraIds[chain] ?? 1000;
  }

  private generateWarnings(data: YieldData): string[] {
    const warnings = [];

    if (data.riskLevel === 'high') {
      warnings.push('⚠️ High risk strategy - only invest what you can afford to lose');
    }

    if (data.auditStatus !== 'audited') {
      warnings.push('🔍 Protocol has limited audit coverage');
    }

    if (data.lockDays > 0) {
      warnings.push(`🔒 Funds will be locked for ${data.lockDays} days`);
    }

    if (data.tvlUsd < 10_000_000) {
      warnings.push('💧 Lower TVL may indicate liquidity risks');
    }

    return warnings;
  }
}