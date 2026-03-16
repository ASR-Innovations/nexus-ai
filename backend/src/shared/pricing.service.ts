import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService, CacheKeys } from './cache.service';
import { StaticDataService } from './static-data.service';

export interface TokenPrice {
  symbol: string;
  priceUsd: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  lastUpdated: number;
}

export interface PriceResponse {
  [tokenId: string]: {
    usd: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
  };
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private readonly coingeckoApiUrl: string;
  private readonly coingeckoApiKey?: string;

  // Token ID mapping for CoinGecko API
  private readonly tokenIdMap = new Map<string, string>([
    ['DOT', 'polkadot'],
    ['KSM', 'kusama'],
    ['HDX', 'hydradx'],
    ['BNC', 'bifrost-native-coin'],
    ['GLMR', 'moonbeam'],
    ['MOVR', 'moonriver'],
    ['USDT', 'tether'],
    ['USDC', 'usd-coin'],
    ['ETH', 'ethereum'],
    ['BTC', 'bitcoin'],
  ]);

  // Token ID mapping for CoinCap API (alternative to CoinGecko)
  private readonly coinCapIdMap = new Map<string, string>([
    ['DOT', 'polkadot'],
    ['KSM', 'kusama'],
    ['HDX', 'hydradx'],
    ['BNC', 'bifrost-native-coin'],
    ['GLMR', 'moonbeam'],
    ['MOVR', 'moonriver'],
    ['USDT', 'tether'],
    ['USDC', 'usd-coin'],
    ['ETH', 'ethereum'],
    ['BTC', 'bitcoin'],
  ]);

  // Fallback prices (in USD) for when API is unavailable
  private readonly fallbackPrices = new Map<string, number>([
    ['DOT', 10.00],
    ['KSM', 50.00],
    ['HDX', 0.05],
    ['BNC', 0.30],
    ['GLMR', 0.50],
    ['MOVR', 15.00],
    ['USDT', 1.00],
    ['USDC', 1.00],
    ['ETH', 3000.00],
    ['BTC', 50000.00],
  ]);

  constructor(
    private configService: ConfigService,
    private cacheService: CacheService,
    private staticDataService: StaticDataService,
  ) {
    this.coingeckoApiUrl = this.configService.get('app.external.coingecko.apiUrl', 'https://api.coingecko.com/api/v3');
    this.coingeckoApiKey = this.configService.get('app.external.coingecko.apiKey');
    
    // Log which pricing service will be used
    if (this.coingeckoApiKey) {
      this.logger.log('Using CoinGecko API with API key (higher rate limits)');
    } else {
      this.logger.log('Using CoinCap API (free, no API key required)');
    }
  }

  async getTokenPrice(symbol: string): Promise<TokenPrice> {
    const cacheKey = CacheKeys.tokenPrice(symbol);
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          // Get token info from database first
          const tokenInfo = await this.staticDataService.getTokenBySymbol(symbol);
          
          if (!tokenInfo) {
            this.logger.warn(`Unknown token symbol: ${symbol}, using fallback price`);
            return this.getFallbackPrice(symbol);
          }

          // Use CoinCap API if no CoinGecko API key is provided
          if (!this.coingeckoApiKey) {
            return await this.fetchFromCoinCap(symbol, tokenInfo);
          }

          // Use CoinGecko API with key
          if (!tokenInfo.coingeckoId) {
            this.logger.warn(`No CoinGecko ID for ${symbol}, using CoinCap fallback`);
            return await this.fetchFromCoinCap(symbol, tokenInfo);
          }

          const response = await this.fetchFromCoinGecko([tokenInfo.coingeckoId]);
          const data = response[tokenInfo.coingeckoId];
          
          if (!data) {
            this.logger.warn(`No price data for ${symbol}, using fallback`);
            return this.getFallbackPrice(symbol);
          }

          return {
            symbol: symbol.toUpperCase(),
            priceUsd: data.usd,
            priceChange24h: data.usd_24h_change,
            marketCap: data.usd_market_cap,
            volume24h: data.usd_24h_vol,
            lastUpdated: Date.now(),
          };

        } catch (error) {
          this.logger.error(`Failed to fetch price for ${symbol}:`, error);
          return this.getFallbackPrice(symbol);
        }
      },
      { ttl: 300 }, // Cache for 5 minutes
    );
  }

  async getMultipleTokenPrices(symbols: string[]): Promise<TokenPrice[]> {
    const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
    
    // Use CoinCap API if no CoinGecko API key
    if (!this.coingeckoApiKey) {
      return await this.fetchMultipleFromCoinCap(uniqueSymbols);
    }

    // Get token info from database for all symbols
    const tokenInfoPromises = uniqueSymbols.map(symbol => 
      this.staticDataService.getTokenBySymbol(symbol)
    );
    const tokenInfos = await Promise.all(tokenInfoPromises);

    // Filter out tokens that don't have CoinGecko IDs
    const validTokens = tokenInfos
      .map((tokenInfo, index) => ({ tokenInfo, symbol: uniqueSymbols[index] }))
      .filter(({ tokenInfo }) => tokenInfo?.coingeckoId);

    if (validTokens.length === 0) {
      this.logger.warn('No valid CoinGecko token IDs found, using CoinCap fallback');
      return await this.fetchMultipleFromCoinCap(uniqueSymbols);
    }

    try {
      const tokenIds = validTokens.map(({ tokenInfo }) => tokenInfo!.coingeckoId!);
      const response = await this.fetchFromCoinGecko(tokenIds);
      
      return uniqueSymbols.map((symbol, index) => {
        const tokenInfo = tokenInfos[index];
        const data = tokenInfo?.coingeckoId ? response[tokenInfo.coingeckoId] : null;
        
        if (!data) {
          this.logger.warn(`No price data for ${symbol}, using fallback`);
          return this.getFallbackPrice(symbol);
        }

        return {
          symbol,
          priceUsd: data.usd,
          priceChange24h: data.usd_24h_change,
          marketCap: data.usd_market_cap,
          volume24h: data.usd_24h_vol,
          lastUpdated: Date.now(),
        };
      });

    } catch (error) {
      this.logger.error('Failed to fetch multiple token prices from CoinGecko, using CoinCap fallback:', error);
      return await this.fetchMultipleFromCoinCap(uniqueSymbols);
    }
  }

  // CoinCap API implementation (free alternative)
  private async fetchFromCoinCap(symbol: string, tokenInfo?: any): Promise<TokenPrice> {
    // Use database token info if available, otherwise fallback to hardcoded mapping
    const coinCapId = tokenInfo?.coincapId || this.coinCapIdMap.get(symbol.toUpperCase());
    
    if (!coinCapId) {
      this.logger.warn(`Unknown token for CoinCap: ${symbol}, using fallback`);
      return this.getFallbackPrice(symbol);
    }

    const url = `https://api.coincap.io/v2/assets/${coinCapId}`;
    
    this.logger.debug(`Fetching price from CoinCap: ${symbol}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NexusAI-Protocol/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinCap API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const asset = data.data;
    
    if (!asset) {
      throw new Error(`No data returned for ${symbol}`);
    }

    return {
      symbol: symbol.toUpperCase(),
      priceUsd: parseFloat(asset.priceUsd),
      priceChange24h: parseFloat(asset.changePercent24Hr),
      marketCap: parseFloat(asset.marketCapUsd),
      volume24h: parseFloat(asset.volumeUsd24Hr),
      lastUpdated: Date.now(),
    };
  }

  private async fetchMultipleFromCoinCap(symbols: string[]): Promise<TokenPrice[]> {
    const results: TokenPrice[] = [];
    
    // Get token info from database for all symbols
    const tokenInfoPromises = symbols.map(symbol => 
      this.staticDataService.getTokenBySymbol(symbol)
    );
    const tokenInfos = await Promise.all(tokenInfoPromises);
    
    // CoinCap doesn't have a bulk endpoint, so we fetch individually
    // But we can do them in parallel
    const promises = symbols.map(async (symbol, index) => {
      try {
        return await this.fetchFromCoinCap(symbol, tokenInfos[index]);
      } catch (error) {
        this.logger.warn(`Failed to fetch ${symbol} from CoinCap:`, error);
        return this.getFallbackPrice(symbol);
      }
    });

    const prices = await Promise.all(promises);
    return prices;
  }

  private async fetchFromCoinGecko(tokenIds: string[]): Promise<PriceResponse> {
    const ids = tokenIds.join(',');
    const params = new URLSearchParams({
      ids,
      vs_currencies: 'usd',
      include_24hr_change: 'true',
      include_market_cap: 'true',
      include_24hr_vol: 'true',
    });

    // Add API key if available (for higher rate limits)
    if (this.coingeckoApiKey) {
      params.append('x_cg_demo_api_key', this.coingeckoApiKey);
    }

    const url = `${this.coingeckoApiUrl}/simple/price?${params.toString()}`;
    
    this.logger.debug(`Fetching prices from CoinGecko: ${tokenIds.join(', ')}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NexusAI-Protocol/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.logger.debug(`Successfully fetched ${Object.keys(data).length} token prices`);
    
    return data;
  }

  private getFallbackPrice(symbol: string): TokenPrice {
    const fallbackPrice = this.fallbackPrices.get(symbol.toUpperCase()) || 1.00;
    
    this.logger.debug(`Using fallback price for ${symbol}: $${fallbackPrice}`);
    
    return {
      symbol: symbol.toUpperCase(),
      priceUsd: fallbackPrice,
      lastUpdated: Date.now(),
    };
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();
    
    try {
      // Test with a simple DOT price fetch
      await this.getTokenPrice('DOT');
      const latency = Date.now() - start;
      
      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}