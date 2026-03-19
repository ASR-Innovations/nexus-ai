/**
 * RPC Connection Pool Service
 * Implements connection pooling for blockchain RPC endpoints
 * Validates: Requirements 8.4
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

export interface PooledConnection {
  provider: ethers.JsonRpcProvider;
  inUse: boolean;
  createdAt: Date;
  lastUsed: Date;
  requestCount: number;
  errorCount: number;
}

export interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalRequests: number;
  averageRequestsPerConnection: number;
  poolUtilization: number;
}

@Injectable()
export class RpcConnectionPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(RpcConnectionPoolService.name);

  // Connection pools per chain
  private pools: Map<number, PooledConnection[]> = new Map();

  // Configuration
  private readonly minPoolSize: number;
  private readonly maxPoolSize: number;
  private readonly connectionTimeout: number;
  private readonly idleTimeout: number;

  // RPC endpoints per chain
  private readonly rpcEndpoints: Map<number, string[]> = new Map();

  // Metrics
  private totalRequests = 0;

  constructor(private readonly configService: ConfigService) {
    this.minPoolSize = this.configService.get<number>('RPC_POOL_MIN_SIZE', 2);
    this.maxPoolSize = this.configService.get<number>('RPC_POOL_MAX_SIZE', 10);
    this.connectionTimeout = this.configService.get<number>(
      'RPC_CONNECTION_TIMEOUT',
      30000
    );
    this.idleTimeout = this.configService.get<number>('RPC_IDLE_TIMEOUT', 300000); // 5 minutes

    this.logger.log('RPC Connection Pool initialized', {
      minPoolSize: this.minPoolSize,
      maxPoolSize: this.maxPoolSize,
    });

    // Initialize RPC endpoints
    this.initializeEndpoints();

    // Start idle connection cleanup
    this.startIdleCleanup();
  }

  // ============================================================================
  // Pool Initialization
  // ============================================================================

  private initializeEndpoints(): void {
    // Moonbase Alpha (testnet)
    this.rpcEndpoints.set(1287, [
      'https://rpc.api.moonbase.moonbeam.network',
      'https://moonbase-alpha.public.blastapi.io',
    ]);

    // Moonbeam (mainnet)
    this.rpcEndpoints.set(1284, [
      'https://rpc.api.moonbeam.network',
      'https://moonbeam.public.blastapi.io',
      'https://moonbeam.api.onfinality.io/public',
    ]);

    // Ethereum Mainnet
    this.rpcEndpoints.set(1, [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
    ]);

    this.logger.debug('RPC endpoints initialized', {
      chains: Array.from(this.rpcEndpoints.keys()),
    });
  }

  /**
   * Initialize connection pool for a chain
   */
  private async initializePool(chainId: number): Promise<void> {
    if (this.pools.has(chainId)) {
      return;
    }

    const endpoints = this.rpcEndpoints.get(chainId);
    if (!endpoints || endpoints.length === 0) {
      throw new Error(`No RPC endpoints configured for chain ${chainId}`);
    }

    const pool: PooledConnection[] = [];

    // Create minimum number of connections
    for (let i = 0; i < this.minPoolSize; i++) {
      const connection = await this.createConnection(chainId, endpoints[i % endpoints.length]);
      pool.push(connection);
    }

    this.pools.set(chainId, pool);

    this.logger.log('Connection pool initialized', {
      chainId,
      size: pool.length,
    });
  }

  /**
   * Create a new pooled connection
   */
  private async createConnection(
    chainId: number,
    rpcUrl: string
  ): Promise<PooledConnection> {
    const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, {
      staticNetwork: true,
    });

    // Test connection
    try {
      await provider.getBlockNumber();
    } catch (error) {
      this.logger.error('Failed to create connection', { chainId, rpcUrl, error });
      throw error;
    }

    const connection: PooledConnection = {
      provider,
      inUse: false,
      createdAt: new Date(),
      lastUsed: new Date(),
      requestCount: 0,
      errorCount: 0,
    };

    this.logger.debug('Connection created', { chainId, rpcUrl });

    return connection;
  }

  // ============================================================================
  // Connection Acquisition
  // ============================================================================

  /**
   * Get a connection from the pool
   * Implements connection pooling for RPC calls (Requirement 8.4)
   */
  async getConnection(chainId: number): Promise<ethers.JsonRpcProvider> {
    // Initialize pool if needed
    if (!this.pools.has(chainId)) {
      await this.initializePool(chainId);
    }

    const pool = this.pools.get(chainId)!;

    // Find idle connection
    let connection = pool.find((conn) => !conn.inUse);

    // If no idle connection and pool not at max, create new one
    if (!connection && pool.length < this.maxPoolSize) {
      const endpoints = this.rpcEndpoints.get(chainId)!;
      const rpcUrl = endpoints[pool.length % endpoints.length];
      connection = await this.createConnection(chainId, rpcUrl);
      pool.push(connection);
    }

    // If still no connection, wait for one to become available
    if (!connection) {
      connection = await this.waitForConnection(chainId);
    }

    // Mark as in use
    connection.inUse = true;
    connection.lastUsed = new Date();
    connection.requestCount++;
    this.totalRequests++;

    this.logger.debug('Connection acquired', {
      chainId,
      poolSize: pool.length,
      activeConnections: pool.filter((c) => c.inUse).length,
    });

    return connection.provider;
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(chainId: number, provider: ethers.JsonRpcProvider): void {
    const pool = this.pools.get(chainId);
    if (!pool) {
      return;
    }

    const connection = pool.find((conn) => conn.provider === provider);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = new Date();

      this.logger.debug('Connection released', {
        chainId,
        requestCount: connection.requestCount,
      });
    }
  }

  /**
   * Execute a function with a pooled connection
   * Automatically acquires and releases connection
   */
  async withConnection<T>(
    chainId: number,
    fn: (provider: ethers.JsonRpcProvider) => Promise<T>
  ): Promise<T> {
    const provider = await this.getConnection(chainId);

    try {
      const result = await fn(provider);
      this.releaseConnection(chainId, provider);
      return result;
    } catch (error) {
      // Mark error on connection
      const pool = this.pools.get(chainId);
      if (pool) {
        const connection = pool.find((conn) => conn.provider === provider);
        if (connection) {
          connection.errorCount++;
        }
      }

      this.releaseConnection(chainId, provider);
      throw error;
    }
  }

  /**
   * Wait for a connection to become available
   */
  private async waitForConnection(chainId: number): Promise<PooledConnection> {
    const pool = this.pools.get(chainId)!;
    const startTime = Date.now();

    while (Date.now() - startTime < this.connectionTimeout) {
      const connection = pool.find((conn) => !conn.inUse);
      if (connection) {
        return connection;
      }

      // Wait 100ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Connection timeout for chain ${chainId}`);
  }

  // ============================================================================
  // Pool Management
  // ============================================================================

  /**
   * Clean up idle connections
   */
  private startIdleCleanup(): void {
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Check every minute
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();

    for (const [chainId, pool] of Array.from(this.pools.entries())) {
      // Keep minimum pool size
      if (pool.length <= this.minPoolSize) {
        continue;
      }

      // Find idle connections that exceeded timeout
      const idleConnections = pool.filter(
        (conn) =>
          !conn.inUse && now - conn.lastUsed.getTime() > this.idleTimeout
      );

      // Remove excess idle connections
      const toRemove = Math.min(
        idleConnections.length,
        pool.length - this.minPoolSize
      );

      for (let i = 0; i < toRemove; i++) {
        const conn = idleConnections[i];
        const index = pool.indexOf(conn);
        if (index >= 0) {
          pool.splice(index, 1);
          conn.provider.destroy();

          this.logger.debug('Idle connection removed', {
            chainId,
            idleTime: now - conn.lastUsed.getTime(),
          });
        }
      }
    }
  }

  /**
   * Remove unhealthy connections
   */
  async removeUnhealthyConnections(chainId: number): Promise<number> {
    const pool = this.pools.get(chainId);
    if (!pool) {
      return 0;
    }

    let removed = 0;

    for (let i = pool.length - 1; i >= 0; i--) {
      const conn = pool[i];

      // Skip connections in use
      if (conn.inUse) {
        continue;
      }

      // Check if connection has too many errors
      if (conn.errorCount > 5) {
        pool.splice(i, 1);
        conn.provider.destroy();
        removed++;

        this.logger.warn('Unhealthy connection removed', {
          chainId,
          errorCount: conn.errorCount,
        });
      }
    }

    // Ensure minimum pool size
    while (pool.length < this.minPoolSize) {
      const endpoints = this.rpcEndpoints.get(chainId)!;
      const rpcUrl = endpoints[pool.length % endpoints.length];
      const connection = await this.createConnection(chainId, rpcUrl);
      pool.push(connection);
    }

    return removed;
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  getMetrics(chainId?: number): ConnectionPoolMetrics {
    if (chainId !== undefined) {
      return this.getChainMetrics(chainId);
    }

    // Aggregate metrics across all chains
    let totalConnections = 0;
    let activeConnections = 0;

    for (const pool of Array.from(this.pools.values())) {
      totalConnections += pool.length;
      activeConnections += pool.filter((c) => c.inUse).length;
    }

    const idleConnections = totalConnections - activeConnections;
    const averageRequestsPerConnection =
      totalConnections > 0 ? this.totalRequests / totalConnections : 0;
    const poolUtilization =
      totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0;

    return {
      totalConnections,
      activeConnections,
      idleConnections,
      totalRequests: this.totalRequests,
      averageRequestsPerConnection,
      poolUtilization,
    };
  }

  private getChainMetrics(chainId: number): ConnectionPoolMetrics {
    const pool = this.pools.get(chainId) || [];
    const activeConnections = pool.filter((c) => c.inUse).length;
    const totalRequests = pool.reduce((sum, c) => sum + c.requestCount, 0);

    return {
      totalConnections: pool.length,
      activeConnections,
      idleConnections: pool.length - activeConnections,
      totalRequests,
      averageRequestsPerConnection:
        pool.length > 0 ? totalRequests / pool.length : 0,
      poolUtilization: pool.length > 0 ? (activeConnections / pool.length) * 100 : 0,
    };
  }

  /**
   * Get detailed pool state
   */
  getPoolState(chainId: number): {
    connections: Array<{
      inUse: boolean;
      age: number;
      requestCount: number;
      errorCount: number;
      lastUsed: number;
    }>;
    metrics: ConnectionPoolMetrics;
  } {
    const pool = this.pools.get(chainId) || [];
    const now = Date.now();

    const connections = pool.map((conn) => ({
      inUse: conn.inUse,
      age: now - conn.createdAt.getTime(),
      requestCount: conn.requestCount,
      errorCount: conn.errorCount,
      lastUsed: now - conn.lastUsed.getTime(),
    }));

    return {
      connections,
      metrics: this.getChainMetrics(chainId),
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async onModuleDestroy() {
    this.logger.log('Closing all RPC connections');

    for (const [chainId, pool] of Array.from(this.pools.entries())) {
      for (const conn of pool) {
        try {
          conn.provider.destroy();
        } catch (error) {
          this.logger.error('Failed to close connection', { chainId, error });
        }
      }
    }

    this.pools.clear();
    this.logger.log('All RPC connections closed');
  }

  /**
   * Clear pool for specific chain
   */
  async clearPool(chainId: number): Promise<void> {
    const pool = this.pools.get(chainId);
    if (!pool) {
      return;
    }

    for (const conn of pool) {
      conn.provider.destroy();
    }

    this.pools.delete(chainId);
    this.logger.log('Pool cleared', { chainId });
  }
}
