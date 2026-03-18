import { Injectable, Logger } from '@nestjs/common';
import { DatabaseProvider } from './database.provider';
import { CacheService, CacheKeys } from './cache.service';

export interface Token {
  id?: number;
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId?: string;
  coincapId?: string;
  logoUrl?: string;
  description?: string;
  website?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Protocol {
  id?: number;
  name: string;
  chain: string;
  category: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  auditStatus: 'audited' | 'partial' | 'unaudited';
  tvlUsd?: number;
  riskLevel: 'low' | 'medium' | 'high';
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Chain {
  id?: number;
  name: string;
  chainId?: number;
  paraId?: number;
  rpcUrl: string;
  wsUrl?: string;
  explorerUrl?: string;
  nativeToken: string;
  logoUrl?: string;
  isTestnet: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class StaticDataService {
  private readonly logger = new Logger(StaticDataService.name);

  constructor(
    private databaseProvider: DatabaseProvider,
    private cacheService: CacheService,
  ) {}

  /**
   * Get all active tokens
   */
  async getTokens(activeOnly: boolean = true): Promise<Token[]> {
    const cacheKey = CacheKeys.staticData('tokens', activeOnly ? 'active' : 'all');
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          let query = 'SELECT * FROM tokens';
          const values: any[] = [];

          if (activeOnly) {
            query += ' WHERE is_active = $1';
            values.push(true);
          }

          query += ' ORDER BY symbol';

          const result = await this.databaseProvider.query(query, values);
          
          return result.rows.map(this.mapTokenRow);
        } catch (error) {
          this.logger.error('Failed to get tokens:', error);
          return [];
        }
      },
      { ttl: 3600 }, // Cache for 1 hour
    );
  }

  /**
   * Get token by symbol
   */
  async getTokenBySymbol(symbol: string): Promise<Token | null> {
    const cacheKey = CacheKeys.staticData('token', symbol.toUpperCase());
    
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const query = 'SELECT * FROM tokens WHERE UPPER(symbol) = $1 AND is_active = true';
          const result = await this.databaseProvider.query(query, [symbol.toUpperCase()]);
          
          return result.rows.length > 0 ? this.mapTokenRow(result.rows[0]) : null;
        } catch (error) {
          this.logger.error(`Failed to get token ${symbol}:`, error);
          return null;
        }
      },
      { ttl: 3600 }, // Cache for 1 hour
    );
  }

  private mapTokenRow(row: any): Token {
    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      decimals: row.decimals,
      coingeckoId: row.coingecko_id,
      coincapId: row.coincap_id,
      logoUrl: row.logo_url,
      description: row.description,
      website: row.website,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Clear static data cache
   */
  async clearCache(): Promise<void> {
    try {
      await this.cacheService.clearPattern('static:*');
      this.logger.log('Static data cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear static data cache:', error);
    }
  }
}