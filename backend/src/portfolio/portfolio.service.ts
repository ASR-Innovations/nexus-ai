import { Injectable, Logger } from '@nestjs/common';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ContractProvider } from '../shared/contract.provider';
import { RedisProvider } from '../shared/redis.provider';
import { Portfolio, Balance, YieldPosition } from './portfolio.dto';

@Injectable()
export class PortfolioService {
  private hydrationApi!: ApiPromise;
  private bifrostApi!: ApiPromise;
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private contractProvider: ContractProvider,
    private redisProvider: RedisProvider,
  ) {
    // Only initialize parachain connections if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      this.initializeParachainConnections();
    }
  }

  private async initializeParachainConnections() {
    try {
      // Initialize Hydration connection
      const hydrationProvider = new WsProvider('wss://rpc.hydradx.cloud');
      this.hydrationApi = await ApiPromise.create({ provider: hydrationProvider });

      // Initialize Bifrost connection
      const bifrostProvider = new WsProvider('wss://bifrost-polkadot.api.onfinality.io/public-ws');
      this.bifrostApi = await ApiPromise.create({ provider: bifrostProvider });

      this.logger.log('Parachain connections initialized');
    } catch (error) {
      this.logger.error('Failed to initialize parachain connections:', error);
    }
  }

  async getPortfolio(address: string): Promise<Portfolio> {
    try {
      // Check cache first
      const cacheKey = `portfolio:${address}`;
      const cached = await this.redisProvider.get(cacheKey);
      if (cached) {
        const portfolio = JSON.parse(cached);
        this.logger.debug(`Returning cached portfolio for ${address}`);
        return portfolio;
      }

      // Aggregate balances from all chains
      const balances = await this.aggregateBalances(address);
      const yieldPositions = await this.getYieldPositions(address);

      // Calculate total USD value
      const totalValueUsd = balances.reduce((sum, balance) => sum + balance.valueUsd, 0) +
                           yieldPositions.reduce((sum, position) => sum + parseFloat(position.currentValue), 0);

      const portfolio: Portfolio = {
        totalValueUsd,
        balances,
        yieldPositions,
        lastUpdated: Date.now(),
        isStale: false,
      };

      // Cache for 30 seconds
      await this.redisProvider.set(cacheKey, JSON.stringify(portfolio), 30);
      this.logger.debug(`Portfolio cached for ${address}`);

      return portfolio;
    } catch (error) {
      this.logger.error('Portfolio aggregation error:', error);

      // Try to return stale cached data
      const cacheKey = `portfolio:${address}`;
      try {
        const stale = await this.redisProvider.get(cacheKey);
        if (stale) {
          const portfolio = JSON.parse(stale);
          portfolio.isStale = true;
          this.logger.warn(`Returning stale portfolio data for ${address}`);
          return portfolio;
        }
      } catch (cacheError) {
        this.logger.error('Failed to retrieve stale cache data:', cacheError);
      }

      // Return empty portfolio if all else fails
      this.logger.warn(`Returning empty portfolio for ${address} due to errors`);
      return {
        totalValueUsd: 0,
        balances: [],
        yieldPositions: [],
        lastUpdated: Date.now(),
        isStale: true,
      };
    }
  }

  private async aggregateBalances(address: string): Promise<Balance[]> {
    const balances: Balance[] = [];

    try {
      // Get DOT/USD price from CoinGecko
      const dotPriceUsd = await this.getDotPriceUsd();

      // Hub balance (native token) - handle errors gracefully
      try {
        const hubBalance = await this.getHubBalance(address);
        if (hubBalance > BigInt(0)) {
          balances.push({
            asset: 'DOT',
            chain: 'Polkadot Hub',
            amount: hubBalance.toString(),
            valueUsd: parseFloat(hubBalance.toString()) / 1e18 * dotPriceUsd,
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to get Hub balance for ${address}:`, error);
      }

      // Hydration balances - handle errors gracefully
      try {
        const hydrationBalances = await this.getHydrationBalances(address);
        balances.push(...hydrationBalances.map(balance => ({
          ...balance,
          valueUsd: parseFloat(balance.amount) / 1e18 * dotPriceUsd, // Assuming DOT for now
        })));
      } catch (error) {
        this.logger.warn(`Failed to get Hydration balances for ${address}:`, error);
      }

      // Bifrost balances - handle errors gracefully
      try {
        const bifrostBalances = await this.getBifrostBalances(address);
        balances.push(...bifrostBalances.map(balance => ({
          ...balance,
          valueUsd: parseFloat(balance.amount) / 1e18 * dotPriceUsd, // Assuming DOT for now
        })));
      } catch (error) {
        this.logger.warn(`Failed to get Bifrost balances for ${address}:`, error);
      }

    } catch (error) {
      this.logger.error('Balance aggregation error:', error);
      // Continue with empty balances array rather than throwing
    }

    return balances;
  }

  private async getHubBalance(address: string): Promise<bigint> {
    try {
      const provider = this.contractProvider.getProvider();
      const balance = await provider.getBalance(address);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to get Hub balance for ${address}:`, error);
      return 0n;
    }
  }

  private async getHydrationBalances(address: string): Promise<Omit<Balance, 'valueUsd'>[]> {
    const balances: Omit<Balance, 'valueUsd'>[] = [];

    try {
      if (!this.hydrationApi?.isConnected) {
        this.logger.warn('Hydration API not connected');
        return balances;
      }

      // Convert Ethereum address to Substrate address format
      const substrateAddress = this.convertToSubstrateAddress(address);

      // Query native DOT balance on Hydration
      const accountInfo = await this.hydrationApi.query.system.account(substrateAddress);
      const accountData = accountInfo.toJSON() as any;
      const freeBalance = BigInt(accountData.data?.free || '0');

      if (freeBalance > 0n) {
        balances.push({
          asset: 'DOT',
          chain: 'Hydration',
          amount: freeBalance.toString(),
        });
      }

      // Query other asset balances (HDX, USDT, etc.)
      const assets = await this.hydrationApi.query.tokens.accounts.entries(substrateAddress);
      for (const [key, balance] of assets) {
        const assetId = key.args[1].toString();
        const balanceData = balance.toJSON() as any;
        const freeBalance = BigInt(balanceData?.free || '0');

        if (freeBalance > 0n) {
          // Map asset ID to symbol (simplified mapping)
          const assetSymbol = this.mapHydrationAssetId(assetId);
          balances.push({
            asset: assetSymbol,
            chain: 'Hydration',
            amount: freeBalance.toString(),
          });
        }
      }

    } catch (error) {
      this.logger.error(`Failed to get Hydration balances for ${address}:`, error);
    }

    return balances;
  }

  private async getBifrostBalances(address: string): Promise<Omit<Balance, 'valueUsd'>[]> {
    const balances: Omit<Balance, 'valueUsd'>[] = [];

    try {
      if (!this.bifrostApi?.isConnected) {
        this.logger.warn('Bifrost API not connected');
        return balances;
      }

      // Convert Ethereum address to Substrate address format
      const substrateAddress = this.convertToSubstrateAddress(address);

      // Query native DOT balance on Bifrost
      const accountInfo = await this.bifrostApi.query.system.account(substrateAddress);
      const accountData = accountInfo.toJSON() as any;
      const freeBalance = BigInt(accountData.data?.free || '0');

      if (freeBalance > 0n) {
        balances.push({
          asset: 'DOT',
          chain: 'Bifrost',
          amount: freeBalance.toString(),
        });
      }

      // Query vDOT and other liquid staking tokens
      const tokens = await this.bifrostApi.query.tokens.accounts.entries(substrateAddress);
      for (const [key, balance] of tokens) {
        const tokenId = key.args[1].toString();
        const balanceData = balance.toJSON() as any;
        const freeBalance = BigInt(balanceData?.free || '0');

        if (freeBalance > 0n) {
          // Map token ID to symbol (simplified mapping)
          const tokenSymbol = this.mapBifrostTokenId(tokenId);
          balances.push({
            asset: tokenSymbol,
            chain: 'Bifrost',
            amount: freeBalance.toString(),
          });
        }
      }

    } catch (error) {
      this.logger.error(`Failed to get Bifrost balances for ${address}:`, error);
    }

    return balances;
  }

  async getYieldPositions(address: string): Promise<YieldPosition[]> {
      try {
        // Query active intents from IntentVault contract
        const positions: YieldPosition[] = [];

        // Get all intents for this user from the contract
        // Note: This is a simplified approach - in production, you'd want to use events or indexer
        const intentVault = this.contractProvider.getIntentVaultContract();

        // Get next intent ID to know the range to check
        // Since we don't have direct access to getNextIntentId, we'll try a reasonable range
        const maxIntentId = 100; // Check first 100 intents

        for (let i = 1; i <= maxIntentId; i++) {
          try {
            // Try to get intent data directly from contract
            const intentData = await intentVault.intents(i);

            // Check if this intent belongs to the user and is in an active state
            if (intentData.user.toLowerCase() === address.toLowerCase() && 
                (intentData.status === 4 || intentData.status === 5)) { // EXECUTING or AWAITING_CONFIRMATION

              // Calculate current value and accrued yield
              const depositedAmount = intentData.amount.toString();
              const startedAt = Number(intentData.createdAt) * 1000; // Convert to milliseconds
              const daysSinceStart = (Date.now() - startedAt) / (1000 * 60 * 60 * 24);

              // Estimate current value based on time elapsed and assumed APY
              // This is simplified - in production, you'd query the actual protocol
              const estimatedApyBps = 1000; // 10% APY as default
              const accruedValue = (parseFloat(depositedAmount) * estimatedApyBps / 10000 * daysSinceStart / 365).toString();
              const currentValue = (parseFloat(depositedAmount) + parseFloat(accruedValue)).toString();

              positions.push({
                intentId: i,
                protocol: 'Unknown', // Would need to decode execution plan to determine
                chain: 'Cross-chain',
                asset: 'DOT',
                depositedAmount,
                currentValue,
                apyBps: estimatedApyBps,
                accruedValue,
                startedAt,
              });
            }
          } catch (error) {
            // Intent might not exist or be accessible, continue to next
            continue;
          }
        }

        return positions;
      } catch (error) {
        this.logger.error('Yield positions error:', error);
        return [];
      }
    }

  private async getDotPriceUsd(): Promise<number> {
    try {
      // Check cache first
      const cacheKey = 'dot_price_usd';
      const cached = await this.redisProvider.get(cacheKey);
      if (cached) {
        return parseFloat(cached);
      }

      // Fetch from CoinGecko
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=polkadot&vs_currencies=usd');
      const data = await response.json();
      const price = data.polkadot?.usd || 10; // Fallback to $10 if API fails

      // Cache for 5 minutes
      await this.redisProvider.set(cacheKey, price.toString(), 300);

      return price;
    } catch (error) {
      this.logger.error('Failed to fetch DOT price:', error);
      return 10; // Fallback price
    }
  }

  private convertToSubstrateAddress(ethereumAddress: string): string {
    // This is a simplified conversion - in production, you'd use proper address conversion
    // For now, we'll assume the address can be used directly or return a placeholder
    // In reality, you'd need to use @polkadot/util-crypto for proper conversion
    return ethereumAddress;
  }

  private mapHydrationAssetId(assetId: string): string {
    // Simplified asset ID mapping for Hydration
    const assetMap: Record<string, string> = {
      '0': 'HDX',
      '1': 'DOT',
      '10': 'USDT',
      '11': 'USDC',
      // Add more mappings as needed
    };
    return assetMap[assetId] || `ASSET_${assetId}`;
  }

  private mapBifrostTokenId(tokenId: string): string {
    // Simplified token ID mapping for Bifrost
    const tokenMap: Record<string, string> = {
      'DOT': 'DOT',
      'vDOT': 'vDOT',
      'BNC': 'BNC',
      // Add more mappings as needed
    };
    return tokenMap[tokenId] || `TOKEN_${tokenId}`;
  }
}
