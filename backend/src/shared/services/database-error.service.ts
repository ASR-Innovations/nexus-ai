import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseServiceImpl } from '../database.service';

@Injectable()
export class DatabaseErrorService {
  private readonly logger = new Logger(DatabaseErrorService.name);
  private isConnected = true;
  private lastConnectionCheck = 0;
  private readonly CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(private readonly databaseService: DatabaseServiceImpl) {}

  /**
   * Execute database query with error handling and retry logic
   * Requirements: 16.12
   */
  async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    retryCount = 3
  ): Promise<{ rows: T[]; rowCount: number }> {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        // Check connection health before executing query
        await this.checkConnectionHealth();

        const result = await this.databaseService.query(query, params);
        
        // Mark connection as healthy on successful query
        this.isConnected = true;
        
        return {
          rows: (result as any).rows || result,
          rowCount: (result as any).rowCount || result.length || 0
        };
      } catch (error) {
        this.logger.error(`Database query failed (attempt ${attempt}/${retryCount}):`, {
          error: error instanceof Error ? error.message : String(error),
          query: query.substring(0, 100) + '...',
          params: params.length,
        });

        // Check if it's a connection error
        if (this.isConnectionError(error)) {
          this.isConnected = false;
          
          if (attempt === retryCount) {
            this.logger.error('Database connection failed after all retries');
            throw new ServiceUnavailableException(
              'Database service is temporarily unavailable. Please try again later.'
            );
          }

          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await this.sleep(delay);
          continue;
        }

        // For non-connection errors, don't retry
        throw error;
      }
    }

    throw new ServiceUnavailableException('Database operation failed after all retries');
  }

  /**
   * Execute database transaction with error handling
   * Requirements: 16.12
   */
  async executeTransaction<T>(
    operations: (client: any) => Promise<T>,
    retryCount = 2
  ): Promise<T> {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        await this.checkConnectionHealth();

        // TODO: Implement transaction method or use beginTransaction
        // const result = await this.databaseService.transaction(operations);
        const result = await operations(null); // Pass null as client for now
        
        this.isConnected = true;
        return result;
      } catch (error) {
        this.logger.error(`Database transaction failed (attempt ${attempt}/${retryCount}):`, {
          error: error instanceof Error ? error.message : String(error),
        });

        if (this.isConnectionError(error)) {
          this.isConnected = false;
          
          if (attempt === retryCount) {
            throw new ServiceUnavailableException(
              'Database service is temporarily unavailable. Please try again later.'
            );
          }

          const delay = Math.min(2000 * attempt, 10000);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new ServiceUnavailableException('Database transaction failed after all retries');
  }

  /**
   * Check database connection health
   */
  private async checkConnectionHealth(): Promise<void> {
    const now = Date.now();
    
    // Only check connection health every 30 seconds to avoid overhead
    if (now - this.lastConnectionCheck < this.CONNECTION_CHECK_INTERVAL) {
      if (!this.isConnected) {
        throw new ServiceUnavailableException('Database connection is unhealthy');
      }
      return;
    }

    try {
      // Simple health check query
      await this.databaseService.query('SELECT 1 as health_check');
      this.isConnected = true;
      this.lastConnectionCheck = now;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      this.isConnected = false;
      this.lastConnectionCheck = now;
      throw new ServiceUnavailableException('Database connection is unhealthy');
    }
  }

  /**
   * Check if error is a connection-related error
   */
  private isConnectionError(error: any): boolean {
    const connectionErrorCodes = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
    ];

    const connectionErrorMessages = [
      'connection terminated',
      'connection refused',
      'connection timeout',
      'server closed the connection',
      'connection lost',
      'connection error',
      'database is not available',
    ];

    // Check error code
    if (error.code && connectionErrorCodes.includes(error.code)) {
      return true;
    }

    // Check error message
    const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return connectionErrorMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    lastCheck: number;
    timeSinceLastCheck: number;
  } {
    return {
      isConnected: this.isConnected,
      lastCheck: this.lastConnectionCheck,
      timeSinceLastCheck: Date.now() - this.lastConnectionCheck,
    };
  }

  /**
   * Force connection health check
   */
  async forceHealthCheck(): Promise<boolean> {
    try {
      await this.checkConnectionHealth();
      return this.isConnected;
    } catch (error) {
      return false;
    }
  }
}