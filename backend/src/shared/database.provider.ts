import { Pool, PoolConfig } from 'pg';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class DatabaseProvider implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseProvider.name);
  private pool!: Pool;

  constructor(private configService: ConfigService) {
    this.initializePool();
  }

  private initializePool(): void {
    const config: PoolConfig = {
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      database: this.configService.get<string>('DB_NAME', 'nexusai'),
      user: this.configService.get<string>('DB_USER', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD'),
      
      // Connection pool settings
      min: this.configService.get<number>('DB_POOL_MIN', 2),
      max: this.configService.get<number>('DB_POOL_MAX', 20),
      idleTimeoutMillis: this.configService.get<number>('DB_IDLE_TIMEOUT', 30000),
      connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT', 2000),
      
      // SSL configuration for production
      ssl: this.configService.get<string>('NODE_ENV') === 'production' 
        ? { rejectUnauthorized: false }
        : false,
    };

    this.pool = new Pool(config);

    // Handle pool errors
    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
    });

    // Log pool events in development
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      this.pool.on('connect', () => {
        this.logger.debug('New client connected to database');
      });

      this.pool.on('remove', () => {
        this.logger.debug('Client removed from pool');
      });
    }

    this.logger.log('Database connection pool initialized');
  }

  /**
   * Get a client from the pool for a single query
   */
  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        this.logger.debug(`Query executed in ${duration}ms: ${text}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Database query error', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient() {
    return this.pool.connect();
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction rolled back', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('Database connection pool closed');
  }
}