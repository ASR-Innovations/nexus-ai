import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseProvider } from '../../shared/database.provider';
import { ContractService } from '../../shared/contract.service';
import { CircuitBreakerService } from '../../shared/circuit-breaker.service';
import { ExecutionEngineService } from './execution-engine.service';
import { MonitoringService } from './monitoring.service';
import { WalletManagerService } from './wallet-manager.service';
import { ErrorHandlingService } from './error-handling.service';
import { ExecutionQueueService } from './execution-queue.service';
import { RpcConnectionPoolService } from './rpc-connection-pool.service';
import { ethers } from 'ethers';

export interface BotConfiguration {
  enabled: boolean;
  pollingIntervalMs: number;
  maxConcurrentExecutions: number;
  minReputationScore: number;
  autoClaimIntents: boolean;
  autoExecuteApproved: boolean;
  networks: NetworkConfig[];
}

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export interface BotHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastActivity: Date;
  activeExecutions: number;
  networkConnections: Record<string, boolean>;
  circuitBreakers: Record<string, string>;
  metrics: {
    totalIntentsProcessed: number;
    successRate: number;
    averageExecutionTime: number;
  };
}

@Injectable()
export class ProductionBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductionBotService.name);
  
  // Bot state
  private isRunning = false;
  private isPaused = false;
  private startTime: Date;
  private lastActivityTime: Date;
  
  // Configuration
  private config: BotConfiguration;
  
  // Network connections
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private connectionHealth: Map<string, boolean> = new Map();
  
  // Execution tracking
  private activeExecutions: Set<number> = new Set();
  
  // Monitoring intervals
  private intentMonitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private networkMonitoringInterval?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseProvider: DatabaseProvider,
    private readonly contractService: ContractService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly executionEngine: ExecutionEngineService,
    private readonly monitoring: MonitoringService,
    private readonly walletManager: WalletManagerService,
    private readonly errorHandler: ErrorHandlingService,
    private readonly executionQueue: ExecutionQueueService,
    private readonly rpcConnectionPool: RpcConnectionPoolService,
  ) {
    this.startTime = new Date();
    this.lastActivityTime = new Date();
    this.config = this.loadConfiguration();
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  async onModuleInit() {
    this.logger.log('🤖 Production Bot initializing...');
    
    if (!this.config.enabled) {
      this.logger.warn('Production Bot is disabled in configuration');
      return;
    }

    try {
      // Initialize network connections
      await this.initializeNetworkConnections();
      
      // Start continuous operation
      await this.start();
      
      this.logger.log('✅ Production Bot initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Production Bot:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('🛑 Production Bot shutting down...');
    await this.stop();
  }

  // ============================================================================
  // Continuous Operation (24/7)
  // ============================================================================

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Production Bot is already running');
      return;
    }

    this.logger.log('🚀 Starting Production Bot continuous operation');
    this.isRunning = true;
    this.isPaused = false;

    // Start intent monitoring loop
    this.startIntentMonitoring();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Start network connection monitoring
    this.startNetworkMonitoring();

    this.logger.log('✅ Production Bot is now running 24/7');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.log('Stopping Production Bot...');
    this.isRunning = false;

    // Clear all intervals
    if (this.intentMonitoringInterval) {
      clearInterval(this.intentMonitoringInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.networkMonitoringInterval) {
      clearInterval(this.networkMonitoringInterval);
    }

    // Wait for active executions to complete
    await this.waitForActiveExecutions();

    // Close network connections
    this.closeNetworkConnections();

    this.logger.log('✅ Production Bot stopped');
  }

  async pause(): Promise<void> {
    this.logger.log('⏸️  Pausing Production Bot');
    this.isPaused = true;
  }

  async resume(): Promise<void> {
    this.logger.log('▶️  Resuming Production Bot');
    this.isPaused = false;
  }

  // ============================================================================
  // Intent Monitoring and Automatic Execution
  // ============================================================================

  private startIntentMonitoring(): void {
    this.logger.log('Starting intent monitoring loop');
    
    this.intentMonitoringInterval = setInterval(
      async () => {
        if (this.isPaused) {
          return;
        }

        try {
          await this.monitorAndProcessIntents();
        } catch (error) {
          this.logger.error('Error in intent monitoring loop:', error);
          // Classify and log error
          const classified = this.errorHandler.classifyError(error as Error, {
            context: 'intent_monitoring',
          });
          this.logger.error('Classified error:', classified);
        }
      },
      this.config.pollingIntervalMs
    );
  }

  private async monitorAndProcessIntents(): Promise<void> {
    try {
      // Check if we have capacity in the queue
      if (!this.executionQueue.hasCapacity()) {
        this.logger.debug('Execution queue at capacity, skipping intent check');
        return;
      }

      // Get agent address
      const agentAddress = this.walletManager.getEVMAddress();
      
      // Check agent reputation
      const reputation = await this.circuitBreaker.execute(
        'agent-registry',
        async () => {
          return await this.contractService.getAgentReputation(agentAddress);
        }
      );

      if (reputation < BigInt(this.config.minReputationScore)) {
        this.logger.warn(`Agent reputation too low: ${reputation} < ${this.config.minReputationScore}`);
        return;
      }

      // Find claimable intents
      if (this.config.autoClaimIntents) {
        await this.findAndClaimIntents(agentAddress);
      }

      // Find approved intents ready for execution
      if (this.config.autoExecuteApproved) {
        await this.findAndExecuteApprovedIntents(agentAddress);
      }

      // Process queued executions
      await this.processQueuedExecutions();

      this.lastActivityTime = new Date();
    } catch (error) {
      this.logger.error('Error monitoring intents:', error);
      throw error;
    }
  }

  private async findAndClaimIntents(agentAddress: string): Promise<void> {
    try {
      // Query database for pending intents
      const result = await this.databaseProvider.query(
        `SELECT * FROM intents 
         WHERE status = 'PENDING' 
         AND deadline > $1
         ORDER BY created_at ASC
         LIMIT 10`,
        [Math.floor(Date.now() / 1000)]
      );

      for (const intent of result.rows) {
        // Check queue capacity
        if (!this.executionQueue.hasCapacity()) {
          break;
        }

        try {
          // Queue the intent for claiming
          const queued = this.executionQueue.enqueue(intent.id, 'basic');
          if (queued) {
            await this.claimIntent(intent.id, agentAddress);
          }
        } catch (error) {
          this.logger.error(`Failed to claim intent ${intent.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error finding claimable intents:', error);
    }
  }

  private async findAndExecuteApprovedIntents(agentAddress: string): Promise<void> {
    try {
      // Query database for approved intents assigned to this agent
      const result = await this.databaseProvider.query(
        `SELECT * FROM intents 
         WHERE status = 'APPROVED' 
         AND assigned_agent = $1
         AND deadline > $2
         ORDER BY created_at ASC
         LIMIT 10`,
        [agentAddress.toLowerCase(), Math.floor(Date.now() / 1000)]
      );

      for (const intent of result.rows) {
        // Check queue capacity
        if (!this.executionQueue.hasCapacity()) {
          break;
        }

        try {
          // Queue the intent for execution
          const queued = this.executionQueue.enqueue(intent.id, 'basic');
          if (!queued) {
            this.logger.warn(`Failed to queue intent ${intent.id}`);
          }
        } catch (error) {
          this.logger.error(`Failed to queue intent ${intent.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error finding approved intents:', error);
    }
  }

  /**
   * Process queued executions
   * Implements concurrent execution with proper queuing (Requirement 8.1)
   */
  private async processQueuedExecutions(): Promise<void> {
    // Process as many queued items as we have capacity for
    while (this.executionQueue.hasCapacity()) {
      const queuedExecution = this.executionQueue.dequeue();
      
      if (!queuedExecution) {
        break; // No more items in queue
      }

      // Execute in background (don't await)
      this.executeQueuedIntent(queuedExecution.intentId).catch((error) => {
        this.logger.error(`Queued execution failed for intent ${queuedExecution.intentId}:`, error);
        this.executionQueue.complete(queuedExecution.intentId, false);
      });
    }
  }

  /**
   * Execute a queued intent
   */
  private async executeQueuedIntent(intentId: number): Promise<void> {
    try {
      // Fetch intent from database
      const result = await this.databaseProvider.query(
        'SELECT * FROM intents WHERE id = $1',
        [intentId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Intent ${intentId} not found`);
      }

      const intent = result.rows[0];
      await this.executeIntent(intent);
      
      // Mark as completed in queue
      this.executionQueue.complete(intentId, true);
    } catch (error) {
      this.logger.error(`Failed to execute queued intent ${intentId}:`, error);
      
      // Try to retry
      const retried = this.executionQueue.retry(intentId);
      if (!retried) {
        this.executionQueue.complete(intentId, false);
      }
    }
  }

  private async claimIntent(intentId: number, agentAddress: string): Promise<void> {
    this.logger.log(`Claiming intent ${intentId}`);

    try {
      // Mark as active
      this.activeExecutions.add(intentId);

      // Record claim in monitoring
      await this.monitoring.recordIntentClaim(intentId, agentAddress);

      // Build and submit claim transaction
      const unsignedTx = await this.contractService.buildClaimIntentTransaction(BigInt(intentId));
      
      // Sign and submit through wallet manager
      const wallet = this.walletManager.getEVMWallet();
      const tx = await wallet.sendTransaction({
        to: unsignedTx.to,
        data: unsignedTx.data,
        value: unsignedTx.value,
        gasLimit: unsignedTx.gasLimit,
        gasPrice: unsignedTx.gasPrice,
      });

      await tx.wait();

      this.logger.log(`✅ Successfully claimed intent ${intentId}`);
    } catch (error) {
      this.logger.error(`Failed to claim intent ${intentId}:`, error);
      await this.monitoring.recordExecutionError(intentId, (error as Error).message);
    } finally {
      this.activeExecutions.delete(intentId);
    }
  }

  private async executeIntent(intent: any): Promise<void> {
    const intentId = intent.id;
    this.logger.log(`Executing intent ${intentId}`);

    try {
      // Mark as active
      this.activeExecutions.add(intentId);

      // Record execution start
      await this.monitoring.recordExecutionStart(intentId);

      // Execute through execution engine using connection pool
      const wallet = this.walletManager.getEVMWallet();
      const provider = await this.rpcConnectionPool.getConnection(1287); // Moonbase Alpha
      
      try {
        const status = await this.executionEngine.executeStrategy(
          {
            id: intentId,
            userAddress: intent.user_address,
            amount: BigInt(intent.amount),
            goalHash: intent.goal_hash,
            maxSlippageBps: intent.max_slippage_bps,
            deadline: intent.deadline,
            approvedProtocols: intent.approved_protocols || [],
            status: intent.status,
          },
          {
            intentId,
            agentAddress: this.walletManager.getEVMAddress(),
            wallet,
            provider,
            maxGasPrice: BigInt(this.configService.get('MAX_GAS_PRICE', '100000000000')),
            slippageTolerance: intent.max_slippage_bps / 10000,
          }
        );

        // Record completion
        await this.monitoring.recordExecutionComplete(
          intentId,
          status.status === 'completed',
          status.gasUsed,
          status.transactionHashes
        );

        this.logger.log(`✅ Successfully executed intent ${intentId}`);
      } finally {
        // Always release connection back to pool
        this.rpcConnectionPool.releaseConnection(1287, provider);
      }
    } catch (error) {
      this.logger.error(`Failed to execute intent ${intentId}:`, error);
      await this.monitoring.recordExecutionError(intentId, (error as Error).message);
    } finally {
      this.activeExecutions.delete(intentId);
    }
  }

  // ============================================================================
  // Network Resilience and Connection Management
  // ============================================================================

  private async initializeNetworkConnections(): Promise<void> {
    this.logger.log('Initializing network connections');

    for (const network of this.config.networks) {
      if (!network.enabled) {
        continue;
      }

      try {
        await this.connectToNetwork(network);
      } catch (error) {
        this.logger.error(`Failed to connect to ${network.name}:`, error);
        this.connectionHealth.set(network.name, false);
      }
    }
  }

  private async connectToNetwork(network: NetworkConfig): Promise<void> {
    this.logger.log(`Connecting to ${network.name} at ${network.rpcUrl}`);

    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    
    // Test connection
    await provider.getBlockNumber();
    
    this.providers.set(network.name, provider);
    this.connectionHealth.set(network.name, true);
    
    this.logger.log(`✅ Connected to ${network.name}`);
  }

  private startNetworkMonitoring(): void {
    this.logger.log('Starting network connection monitoring');
    
    this.networkMonitoringInterval = setInterval(
      async () => {
        await this.monitorNetworkConnections();
      },
      30000 // Check every 30 seconds
    );
  }

  private async monitorNetworkConnections(): Promise<void> {
    for (const network of this.config.networks) {
      if (!network.enabled) {
        continue;
      }

      const isHealthy = await this.checkNetworkHealth(network);
      const wasHealthy = this.connectionHealth.get(network.name);

      if (!isHealthy && wasHealthy) {
        this.logger.warn(`Network ${network.name} connection lost, attempting reconnection`);
        await this.reconnectToNetwork(network);
      }
    }
  }

  private async checkNetworkHealth(network: NetworkConfig): Promise<boolean> {
    try {
      const provider = this.providers.get(network.name);
      if (!provider) {
        return false;
      }

      // Try to get current block number
      await provider.getBlockNumber();
      this.connectionHealth.set(network.name, true);
      return true;
    } catch (error) {
      this.logger.error(`Health check failed for ${network.name}:`, error);
      this.connectionHealth.set(network.name, false);
      return false;
    }
  }

  private async reconnectToNetwork(network: NetworkConfig): Promise<void> {
    let retries = 0;
    
    while (retries < network.maxRetries) {
      try {
        this.logger.log(`Reconnection attempt ${retries + 1}/${network.maxRetries} for ${network.name}`);
        
        await this.connectToNetwork(network);
        
        this.logger.log(`✅ Successfully reconnected to ${network.name}`);
        return;
      } catch (error) {
        retries++;
        this.logger.error(`Reconnection attempt ${retries} failed for ${network.name}:`, error);
        
        if (retries < network.maxRetries) {
          await this.delay(network.retryDelayMs * Math.pow(2, retries - 1)); // Exponential backoff
        }
      }
    }

    this.logger.error(`Failed to reconnect to ${network.name} after ${network.maxRetries} attempts`);
  }

  private closeNetworkConnections(): void {
    this.logger.log('Closing network connections');
    
    for (const [name, provider] of this.providers.entries()) {
      try {
        provider.destroy();
        this.logger.log(`Closed connection to ${name}`);
      } catch (error) {
        this.logger.error(`Error closing connection to ${name}:`, error);
      }
    }
    
    this.providers.clear();
    this.connectionHealth.clear();
  }

  // ============================================================================
  // Health Monitoring and Metrics Reporting
  // ============================================================================

  private startHealthMonitoring(): void {
    this.logger.log('Starting health monitoring');
    
    this.healthCheckInterval = setInterval(
      async () => {
        await this.performHealthCheck();
      },
      60000 // Check every minute
    );
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getHealth();
      
      // Log health status
      this.logger.debug(`Health check: ${health.status}`, {
        activeExecutions: health.activeExecutions,
        uptime: Math.floor(health.uptime / 1000) + 's',
      });

      // Check for critical issues
      if (health.status === 'unhealthy') {
        this.logger.error('🚨 Bot health is UNHEALTHY', health);
        await this.handleCriticalHealthIssue(health);
      } else if (health.status === 'degraded') {
        this.logger.warn('⚠️  Bot health is DEGRADED', health);
      }

      // Report metrics
      await this.reportMetrics(health);
    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  async getHealth(): Promise<BotHealth> {
    const agentAddress = this.walletManager.getEVMAddress();
    const metrics = await this.monitoring.getBotMetrics(agentAddress);
    const circuitBreakers = this.circuitBreaker.getAllStats();

    // Determine overall health status
    const networkHealthy = Array.from(this.connectionHealth.values()).every(h => h);
    const hasRecentActivity = Date.now() - this.lastActivityTime.getTime() < 300000; // 5 minutes
    const circuitBreakersHealthy = Object.values(circuitBreakers).every(
      cb => cb.state !== 'OPEN'
    );

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (networkHealthy && hasRecentActivity && circuitBreakersHealthy) {
      status = 'healthy';
    } else if (!networkHealthy || !circuitBreakersHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      uptime: Date.now() - this.startTime.getTime(),
      lastActivity: this.lastActivityTime,
      activeExecutions: this.activeExecutions.size,
      networkConnections: Object.fromEntries(this.connectionHealth),
      circuitBreakers: Object.fromEntries(
        Object.entries(circuitBreakers).map(([k, v]) => [k, v.state])
      ),
      metrics: {
        totalIntentsProcessed: metrics.totalIntentsClaimed,
        successRate: metrics.successfulExecutions / (metrics.successfulExecutions + metrics.failedExecutions) * 100 || 0,
        averageExecutionTime: metrics.averageExecutionTime,
      },
    };
  }

  private async handleCriticalHealthIssue(health: BotHealth): Promise<void> {
    this.logger.error('Handling critical health issue');

    // Pause bot operations
    await this.pause();

    // Attempt to recover
    try {
      // Reconnect to unhealthy networks
      for (const [network, isHealthy] of Object.entries(health.networkConnections)) {
        if (!isHealthy) {
          const networkConfig = this.config.networks.find(n => n.name === network);
          if (networkConfig) {
            await this.reconnectToNetwork(networkConfig);
          }
        }
      }

      // Reset open circuit breakers
      for (const [service, state] of Object.entries(health.circuitBreakers)) {
        if (state === 'OPEN') {
          this.circuitBreaker.reset(service);
        }
      }

      // Resume operations
      await this.resume();
      
      this.logger.log('✅ Recovered from critical health issue');
    } catch (error) {
      this.logger.error('Failed to recover from critical health issue:', error);
    }
  }

  private async reportMetrics(health: BotHealth): Promise<void> {
    // Log metrics for external monitoring systems
    this.logger.log('📊 Bot Metrics', {
      status: health.status,
      uptime: Math.floor(health.uptime / 1000),
      activeExecutions: health.activeExecutions,
      totalProcessed: health.metrics.totalIntentsProcessed,
      successRate: health.metrics.successRate.toFixed(2) + '%',
      avgExecutionTime: health.metrics.averageExecutionTime + 'ms',
    });
  }

  // ============================================================================
  // Scheduled Tasks
  // ============================================================================

  @Cron(CronExpression.EVERY_HOUR)
  async performHourlyMaintenance(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.log('Performing hourly maintenance');

    try {
      // Clean up old execution records
      await this.cleanupOldRecords();

      // Update gas price estimates
      await this.updateGasPrices();

      // Check agent reputation
      await this.checkAgentReputation();
    } catch (error) {
      this.logger.error('Hourly maintenance failed:', error);
    }
  }

  private async cleanupOldRecords(): Promise<void> {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
    
    await this.databaseProvider.query(
      'DELETE FROM bot_execution_logs WHERE created_at < $1',
      [cutoffTime]
    );
  }

  private async updateGasPrices(): Promise<void> {
    // Update gas price estimates for all networks
    for (const [name, provider] of this.providers.entries()) {
      try {
        const feeData = await provider.getFeeData();
        this.logger.debug(`Gas price for ${name}: ${feeData.gasPrice}`);
      } catch (error) {
        this.logger.error(`Failed to update gas price for ${name}:`, error);
      }
    }
  }

  private async checkAgentReputation(): Promise<void> {
    const agentAddress = this.walletManager.getEVMAddress();
    const reputation = await this.contractService.getAgentReputation(agentAddress);
    
    this.logger.log(`Current agent reputation: ${reputation}`);
    
    if (reputation < BigInt(this.config.minReputationScore)) {
      this.logger.warn('⚠️  Agent reputation below minimum threshold');
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private loadConfiguration(): BotConfiguration {
    return {
      enabled: this.configService.get<boolean>('BOT_ENABLED', true),
      pollingIntervalMs: this.configService.get<number>('BOT_POLLING_INTERVAL_MS', 10000),
      maxConcurrentExecutions: this.configService.get<number>('BOT_MAX_CONCURRENT_EXECUTIONS', 5),
      minReputationScore: this.configService.get<number>('BOT_MIN_REPUTATION', 3000),
      autoClaimIntents: this.configService.get<boolean>('BOT_AUTO_CLAIM', true),
      autoExecuteApproved: this.configService.get<boolean>('BOT_AUTO_EXECUTE', true),
      networks: [
        {
          name: 'polkadot-hub',
          rpcUrl: this.configService.get<string>('POLKADOT_HUB_RPC_URL', 'https://polkadot-asset-hub-rpc.polkadot.io'),
          chainId: 0,
          enabled: true,
          maxRetries: 5,
          retryDelayMs: 5000,
        },
        {
          name: 'moonbeam',
          rpcUrl: this.configService.get<string>('MOONBEAM_RPC_URL', 'https://rpc.api.moonbeam.network'),
          chainId: 1284,
          enabled: this.configService.get<boolean>('MOONBEAM_ENABLED', false),
          maxRetries: 5,
          retryDelayMs: 5000,
        },
      ],
    };
  }

  private async waitForActiveExecutions(): Promise<void> {
    if (this.activeExecutions.size === 0) {
      return;
    }

    this.logger.log(`Waiting for ${this.activeExecutions.size} active executions to complete`);
    
    const timeout = 300000; // 5 minutes
    const startTime = Date.now();
    
    while (this.activeExecutions.size > 0 && Date.now() - startTime < timeout) {
      await this.delay(1000);
    }

    if (this.activeExecutions.size > 0) {
      this.logger.warn(`Timeout waiting for executions, ${this.activeExecutions.size} still active`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Public API
  // ============================================================================

  isOperational(): boolean {
    return this.isRunning && !this.isPaused;
  }

  getStatus(): {
    running: boolean;
    paused: boolean;
    uptime: number;
    activeExecutions: number;
  } {
    return {
      running: this.isRunning,
      paused: this.isPaused,
      uptime: Date.now() - this.startTime.getTime(),
      activeExecutions: this.activeExecutions.size,
    };
  }
}
