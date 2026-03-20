import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseProvider } from '../../shared/database.provider';
import { RedisService } from '../../shared/redis.service';
import { SecurityMonitoringService } from '../../shared/services/security-monitoring.service';

export interface BotMetrics {
  totalIntentsClaimed: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalGasUsed: string;
  totalFeesEarned: string;
  currentReputation: number;
  activeIntents: number;
  uptime: number;
  lastActivity: Date;
}

export interface ExecutionMetrics {
  intentId: number;
  status: 'claimed' | 'plan_submitted' | 'approved' | 'executing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  gasUsed?: string;
  transactionHashes: string[];
  errorMessage?: string;
}

export interface ServiceHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
  error?: string;
}

export interface AlertConfig {
  type: 'execution_failure' | 'gas_spike' | 'low_balance' | 'reputation_drop' | 'service_down';
  threshold: number;
  enabled: boolean;
  webhookUrl?: string;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly METRICS_KEY = 'bot:metrics';
  private readonly EXECUTION_KEY = 'bot:executions';
  private readonly HEALTH_KEY = 'bot:health';
  private readonly ALERT_KEY = 'bot:alerts';
  private startTime = Date.now();

  // Alert configurations
  private alertConfigs: Map<string, AlertConfig> = new Map();
  
  // Service health tracking
  private serviceHealthChecks: Map<string, ServiceHealthCheck> = new Map();

  constructor(
    private configService: ConfigService,
    private databaseProvider: DatabaseProvider,
    private redisService: RedisService,
    private securityMonitoring: SecurityMonitoringService,
  ) {
    this.initializeAlertConfigs();
  }

  private initializeAlertConfigs(): void {
    // Initialize alert configurations from environment
    this.alertConfigs.set('execution_failure', {
      type: 'execution_failure',
      threshold: this.configService.get<number>('ALERT_EXECUTION_FAILURE_THRESHOLD', 3),
      enabled: this.configService.get<boolean>('ERROR_NOTIFICATION_ENABLED', true),
      webhookUrl: this.configService.get<string>('SLACK_WEBHOOK_URL'),
    });

    this.alertConfigs.set('gas_spike', {
      type: 'gas_spike',
      threshold: this.configService.get<number>('ALERT_GAS_PRICE_SPIKE_THRESHOLD', 200),
      enabled: true,
      webhookUrl: this.configService.get<string>('SLACK_WEBHOOK_URL'),
    });

    this.alertConfigs.set('low_balance', {
      type: 'low_balance',
      threshold: this.configService.get<number>('ALERT_BALANCE_LOW_THRESHOLD', 1000000000000000000),
      enabled: true,
      webhookUrl: this.configService.get<string>('SLACK_WEBHOOK_URL'),
    });

    this.alertConfigs.set('reputation_drop', {
      type: 'reputation_drop',
      threshold: this.configService.get<number>('ALERT_REPUTATION_DROP_THRESHOLD', 500),
      enabled: true,
      webhookUrl: this.configService.get<string>('SLACK_WEBHOOK_URL'),
    });
  }

  async recordIntentClaim(intentId: number, agentAddress: string): Promise<void> {
    try {
      await this.incrementMetric('totalIntentsClaimed');
      await this.recordExecution(intentId, 'claimed');
      
      // Store in database for persistence
      await this.databaseProvider.query(
        `INSERT INTO bot_execution_logs (intent_id, agent_address, status, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (intent_id) DO UPDATE SET
         status = $3, updated_at = $4`,
        [intentId, agentAddress, 'claimed', Date.now()]
      );

      this.logger.log(`📊 Recorded intent claim: ${intentId} by ${agentAddress}`);
    } catch (error) {
      this.logger.error('Failed to record intent claim:', error);
    }
  }

  async recordExecutionStart(intentId: number): Promise<void> {
    try {
      await this.updateExecutionStatus(intentId, 'executing');
      await this.updateLastActivity();
      
      this.logger.log(`⚡ Execution started for intent ${intentId}`);
    } catch (error) {
      this.logger.error('Failed to record execution start:', error);
    }
  }

  async recordExecutionComplete(
    intentId: number, 
    success: boolean, 
    gasUsed?: string, 
    transactionHashes?: string[]
  ): Promise<void> {
    try {
      const status = success ? 'completed' : 'failed';
      
      if (success) {
        await this.incrementMetric('successfulExecutions');
      } else {
        await this.incrementMetric('failedExecutions');
      }

      if (gasUsed) {
        await this.addToMetric('totalGasUsed', gasUsed);
      }

      // Update execution record
      const execution = await this.getExecution(intentId);
      if (execution) {
        const duration = Date.now() - execution.startTime.getTime();
        await this.updateExecutionDuration(intentId, duration);
        await this.updateAverageExecutionTime(duration);
      }

      await this.updateExecutionStatus(intentId, status);
      await this.updateLastActivity();

      // Update database
      await this.databaseProvider.query(
        `UPDATE bot_execution_logs 
         SET status = $1, gas_used = $2, transaction_hashes = $3, completed_at = $4, updated_at = $4
         WHERE intent_id = $5`,
        [status, gasUsed || null, JSON.stringify(transactionHashes || []), Date.now(), intentId]
      );

      this.logger.log(`✅ Execution ${success ? 'completed' : 'failed'} for intent ${intentId}`);
    } catch (error) {
      this.logger.error('Failed to record execution completion:', error);
    }
  }

  async recordExecutionError(intentId: number, error: string): Promise<void> {
    try {
      await this.incrementMetric('failedExecutions');
      await this.updateExecutionStatus(intentId, 'failed');
      
      // Store error details
      await this.redisService.set(
        `${this.EXECUTION_KEY}:${intentId}:error`,
        error,
        3600 // 1 hour TTL
      );

      // Update database
      await this.databaseProvider.query(
        `UPDATE bot_execution_logs 
         SET status = 'failed', error_message = $1, updated_at = $2
         WHERE intent_id = $3`,
        [error, Date.now(), intentId]
      );

      // Report to security monitoring
      await this.securityMonitoring.recordSecurityEvent({
        type: 'EXECUTION_ERROR',
        category: 'BOT_OPERATION',
        message: `Bot execution failed for intent ${intentId}`,
        details: { intentId, error },
        timestamp: new Date(),
      });

      this.logger.error(`❌ Execution error for intent ${intentId}: ${error}`);
    } catch (err) {
      this.logger.error('Failed to record execution error:', err);
    }
  }

  async getBotMetrics(agentAddress: string): Promise<BotMetrics> {
    try {
      const metrics = await this.getMetrics();
      
      // Get current reputation from database
      const reputationResult = await this.databaseProvider.query(
        'SELECT reputation_score FROM agents WHERE address = $1',
        [agentAddress]
      );
      
      const currentReputation = reputationResult.rows[0]?.reputation_score || 0;
      
      // Count active intents
      const activeResult = await this.databaseProvider.query(
        `SELECT COUNT(*) FROM bot_execution_logs 
         WHERE agent_address = $1 AND status IN ('claimed', 'plan_submitted', 'approved', 'executing')`,
        [agentAddress]
      );
      
      const activeIntents = parseInt(activeResult.rows[0]?.count || '0');
      
      return {
        totalIntentsClaimed: metrics.totalIntentsClaimed,
        successfulExecutions: metrics.successfulExecutions,
        failedExecutions: metrics.failedExecutions,
        averageExecutionTime: metrics.averageExecutionTime,
        totalGasUsed: metrics.totalGasUsed,
        totalFeesEarned: metrics.totalFeesEarned,
        currentReputation,
        activeIntents,
        uptime: Date.now() - this.startTime,
        lastActivity: new Date(metrics.lastActivity),
      };
    } catch (error) {
      this.logger.error('Failed to get bot metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  async getExecutionHistory(limit: number = 50): Promise<ExecutionMetrics[]> {
    try {
      const result = await this.databaseProvider.query(
        `SELECT * FROM bot_execution_logs 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit]
      );

      return result.rows.map((row: any) => ({
        intentId: row.intent_id,
        status: row.status,
        startTime: new Date(row.created_at),
        endTime: row.completed_at ? new Date(row.completed_at) : undefined,
        duration: row.completed_at ? row.completed_at - row.created_at : undefined,
        gasUsed: row.gas_used,
        transactionHashes: row.transaction_hashes ? JSON.parse(row.transaction_hashes) : [],
        errorMessage: row.error_message,
      }));
    } catch (error) {
      this.logger.error('Failed to get execution history:', error);
      return [];
    }
  }

  async getPerformanceStats(): Promise<{
    successRate: number;
    averageGasUsage: string;
    totalVolume: string;
    recentActivity: any[];
  }> {
    try {
      const metrics = await this.getMetrics();
      const total = metrics.successfulExecutions + metrics.failedExecutions;
      const successRate = total > 0 ? (metrics.successfulExecutions / total) * 100 : 0;

      // Get recent activity from database
      const recentResult = await this.databaseProvider.query(
        `SELECT intent_id, status, created_at, completed_at, gas_used
         FROM bot_execution_logs 
         WHERE created_at > $1
         ORDER BY created_at DESC 
         LIMIT 10`,
        [Date.now() - 86400000] // Last 24 hours
      );

      return {
        successRate: Math.round(successRate * 100) / 100,
        averageGasUsage: metrics.totalGasUsed,
        totalVolume: '0', // Would calculate from intent amounts
        recentActivity: recentResult.rows,
      };
    } catch (error) {
      this.logger.error('Failed to get performance stats:', error);
      return {
        successRate: 0,
        averageGasUsage: '0',
        totalVolume: '0',
        recentActivity: [],
      };
    }
  }

  async recordReputationChange(agentAddress: string, oldScore: number, newScore: number, reason: string): Promise<void> {
    try {
      await this.securityMonitoring.recordReputationChange(agentAddress, oldScore, newScore, reason);
      
      // Store in our metrics
      await this.redisService.set(
        `${this.METRICS_KEY}:reputation:${agentAddress}`,
        newScore.toString(),
        86400 // 24 hours TTL
      );

      this.logger.log(`📈 Reputation updated for ${agentAddress}: ${oldScore} → ${newScore} (${reason})`);
    } catch (error) {
      this.logger.error('Failed to record reputation change:', error);
    }
  }

  // Health check methods
  async isHealthy(): Promise<boolean> {
    try {
      // Check if we can access Redis
      await this.redisService.ping();
      
      // Check if we can access database
      await this.databaseProvider.query('SELECT 1');
      
      // Check if we have recent activity (within last hour)
      const lastActivity = await this.getMetric('lastActivity');
      const oneHourAgo = Date.now() - 3600000;
      
      return lastActivity > oneHourAgo;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    uptime: number;
    lastActivity: Date;
  }> {
    const checks = {
      redis: false,
      database: false,
      recentActivity: false,
    };

    try {
      // Redis check
      try {
        await this.redisService.ping();
        checks.redis = true;
      } catch (error) {
        this.logger.warn('Redis health check failed:', error);
      }

      // Database check
      try {
        await this.databaseProvider.query('SELECT 1');
        checks.database = true;
      } catch (error) {
        this.logger.warn('Database health check failed:', error);
      }

      // Activity check
      const lastActivity = await this.getMetric('lastActivity');
      const oneHourAgo = Date.now() - 3600000;
      checks.recentActivity = lastActivity > oneHourAgo;

      const healthyChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyChecks === totalChecks) {
        status = 'healthy';
      } else if (healthyChecks >= totalChecks / 2) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        checks,
        uptime: Date.now() - this.startTime,
        lastActivity: new Date(lastActivity),
      };
    } catch (error) {
      this.logger.error('Failed to get health status:', error);
      return {
        status: 'unhealthy',
        checks,
        uptime: Date.now() - this.startTime,
        lastActivity: new Date(0),
      };
    }
  }

  // Private helper methods
  private async incrementMetric(key: string): Promise<void> {
    await this.redisService.incr(`${this.METRICS_KEY}:${key}`);
  }

  private async addToMetric(key: string, value: string): Promise<void> {
    const current = await this.getMetric(key);
    const newValue = (BigInt(current) + BigInt(value)).toString();
    await this.redisService.set(`${this.METRICS_KEY}:${key}`, newValue);
  }

  private async getMetric(key: string): Promise<number> {
    const value = await this.redisService.get(`${this.METRICS_KEY}:${key}`);
    return value ? parseInt(value) : 0;
  }

  private async getMetrics(): Promise<{
    totalIntentsClaimed: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    totalGasUsed: string;
    totalFeesEarned: string;
    lastActivity: number;
  }> {
    const keys = [
      'totalIntentsClaimed',
      'successfulExecutions', 
      'failedExecutions',
      'averageExecutionTime',
      'totalGasUsed',
      'totalFeesEarned',
      'lastActivity'
    ];

    const values = await Promise.all(
      keys.map(key => this.redisService.get(`${this.METRICS_KEY}:${key}`))
    );

    return {
      totalIntentsClaimed: parseInt(values[0] || '0'),
      successfulExecutions: parseInt(values[1] || '0'),
      failedExecutions: parseInt(values[2] || '0'),
      averageExecutionTime: parseInt(values[3] || '0'),
      totalGasUsed: values[4] || '0',
      totalFeesEarned: values[5] || '0',
      lastActivity: parseInt(values[6] || '0'),
    };
  }

  private async recordExecution(intentId: number, status: string): Promise<void> {
    const execution = {
      intentId,
      status,
      startTime: new Date(),
      transactionHashes: [],
    };

    await this.redisService.set(
      `${this.EXECUTION_KEY}:${intentId}`,
      JSON.stringify(execution),
      86400 // 24 hours TTL
    );
  }

  private async updateExecutionStatus(intentId: number, status: string): Promise<void> {
    const executionData = await this.redisService.get(`${this.EXECUTION_KEY}:${intentId}`);
    if (executionData) {
      const execution = JSON.parse(executionData);
      execution.status = status;
      if (status === 'completed' || status === 'failed') {
        execution.endTime = new Date();
      }
      
      await this.redisService.set(
        `${this.EXECUTION_KEY}:${intentId}`,
        JSON.stringify(execution),
        86400
      );
    }
  }

  private async getExecution(intentId: number): Promise<ExecutionMetrics | null> {
    try {
      const executionData = await this.redisService.get(`${this.EXECUTION_KEY}:${intentId}`);
      if (executionData) {
        const data = JSON.parse(executionData);
        return {
          intentId: data.intentId,
          status: data.status,
          startTime: new Date(data.startTime),
          endTime: data.endTime ? new Date(data.endTime) : undefined,
          duration: data.duration,
          gasUsed: data.gasUsed,
          transactionHashes: data.transactionHashes || [],
          errorMessage: data.errorMessage,
        };
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to get execution:', error);
      return null;
    }
  }

  private async updateExecutionDuration(intentId: number, duration: number): Promise<void> {
    const executionData = await this.redisService.get(`${this.EXECUTION_KEY}:${intentId}`);
    if (executionData) {
      const execution = JSON.parse(executionData);
      execution.duration = duration;
      
      await this.redisService.set(
        `${this.EXECUTION_KEY}:${intentId}`,
        JSON.stringify(execution),
        86400
      );
    }
  }

  private async updateAverageExecutionTime(duration: number): Promise<void> {
    const currentAvg = await this.getMetric('averageExecutionTime');
    const totalExecutions = await this.getMetric('successfulExecutions') + await this.getMetric('failedExecutions');
    
    if (totalExecutions > 0) {
      const newAvg = ((currentAvg * (totalExecutions - 1)) + duration) / totalExecutions;
      await this.redisService.set(`${this.METRICS_KEY}:averageExecutionTime`, Math.round(newAvg).toString());
    }
  }

  private async updateLastActivity(): Promise<void> {
    await this.redisService.set(`${this.METRICS_KEY}:lastActivity`, Date.now().toString());
  }

  private getEmptyMetrics(): BotMetrics {
    return {
      totalIntentsClaimed: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalGasUsed: '0',
      totalFeesEarned: '0',
      currentReputation: 0,
      activeIntents: 0,
      uptime: Date.now() - this.startTime,
      lastActivity: new Date(0),
    };
  }
}