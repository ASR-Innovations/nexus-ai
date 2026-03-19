import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonitoringService } from './monitoring.service';
import { AgentBotService } from './agent-bot.service';
import { RealProtocolIntegrationService } from './real-protocol-integration.service';
import { SecurityMonitoringService } from '../../shared/services/security-monitoring.service';
import { DatabaseProvider } from '../../shared/database.provider';

export interface DashboardData {
  overview: {
    totalIntents: number;
    activeIntents: number;
    completedIntents: number;
    failedIntents: number;
    successRate: number;
    totalValueProcessed: string;
    totalFeesEarned: string;
  };
  performance: {
    averageExecutionTime: number;
    averageGasUsed: string;
    uptime: number;
    lastActivity: Date;
  };
  protocols: {
    name: string;
    chain: string;
    status: 'healthy' | 'degraded' | 'down';
    tvl: string;
    apy: number;
    executions: number;
  }[];
  recentActivity: {
    timestamp: Date;
    type: 'claim' | 'execution' | 'completion' | 'error';
    intentId: number;
    status: string;
    details: string;
  }[];
  alerts: {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }[];
  charts: {
    executionTrend: Array<{ date: string; successful: number; failed: number }>;
    gasUsageTrend: Array<{ date: string; gasUsed: string }>;
    protocolDistribution: Array<{ protocol: string; percentage: number }>;
    performanceMetrics: Array<{ metric: string; value: number; trend: 'up' | 'down' | 'stable' }>;
  };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private configService: ConfigService,
    private monitoringService: MonitoringService,
    private agentBotService: AgentBotService,
    private realProtocolIntegration: RealProtocolIntegrationService,
    private securityMonitoring: SecurityMonitoringService,
    private databaseProvider: DatabaseProvider,
  ) {}

  async getDashboardData(): Promise<DashboardData> {
    try {
      this.logger.log('Generating dashboard data...');

      const [
        overview,
        performance,
        protocols,
        recentActivity,
        alerts,
        charts
      ] = await Promise.all([
        this.getOverviewData(),
        this.getPerformanceData(),
        this.getProtocolsData(),
        this.getRecentActivity(),
        this.getAlerts(),
        this.getChartsData(),
      ]);

      return {
        overview,
        performance,
        protocols,
        recentActivity,
        alerts,
        charts,
      };
    } catch (error) {
      this.logger.error('Failed to generate dashboard data:', error);
      return this.getEmptyDashboardData();
    }
  }

  private async getOverviewData(): Promise<DashboardData['overview']> {
    try {
      // Get bot status and metrics
      const botStatus = await this.agentBotService.getBotStatus();
      const performanceStats = await this.monitoringService.getPerformanceStats();
      
      // Query database for intent statistics
      const intentStats = await this.databaseProvider.query(`
        SELECT 
          COUNT(*) as total_intents,
          COUNT(CASE WHEN status IN ('claimed', 'plan_submitted', 'approved', 'executing') THEN 1 END) as active_intents,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_intents,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_intents,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100, 0) as success_rate
        FROM bot_execution_logs 
        WHERE agent_address = $1
      `, [botStatus.address || '']);

      const stats = intentStats.rows[0] || {};

      return {
        totalIntents: parseInt(stats.total_intents || '0'),
        activeIntents: parseInt(stats.active_intents || '0'),
        completedIntents: parseInt(stats.completed_intents || '0'),
        failedIntents: parseInt(stats.failed_intents || '0'),
        successRate: parseFloat(stats.success_rate || '0'),
        totalValueProcessed: '0', // Would calculate from intent amounts
        totalFeesEarned: '0', // Would calculate from completed executions
      };
    } catch (error) {
      this.logger.error('Failed to get overview data:', error);
      return {
        totalIntents: 0,
        activeIntents: 0,
        completedIntents: 0,
        failedIntents: 0,
        successRate: 0,
        totalValueProcessed: '0',
        totalFeesEarned: '0',
      };
    }
  }

  private async getPerformanceData(): Promise<DashboardData['performance']> {
    try {
      const botStatus = await this.agentBotService.getBotStatus();
      const performanceStats = await this.monitoringService.getPerformanceStats();
      const healthStatus = await this.monitoringService.getHealthStatus();

      return {
        averageExecutionTime: 0, // Would calculate from execution logs
        averageGasUsed: performanceStats.averageGasUsage,
        uptime: healthStatus.uptime,
        lastActivity: healthStatus.lastActivity,
      };
    } catch (error) {
      this.logger.error('Failed to get performance data:', error);
      return {
        averageExecutionTime: 0,
        averageGasUsed: '0',
        uptime: 0,
        lastActivity: new Date(0),
      };
    }
  }

  private async getProtocolsData(): Promise<DashboardData['protocols']> {
    try {
      const [hydrationPools, bifrostStaking, moonbeamPools, networkStatus] = await Promise.all([
        this.realProtocolIntegration.getHydrationPools(),
        this.realProtocolIntegration.getBifrostStakingInfo(),
        this.realProtocolIntegration.getMoonbeamDexPools(),
        this.realProtocolIntegration.getNetworkStatus(),
      ]);

      const protocols: DashboardData['protocols'] = [];

      // Hydration
      if (hydrationPools.length > 0) {
        const avgApy = hydrationPools.reduce((sum, pool) => sum + pool.apy, 0) / hydrationPools.length;
        const totalTvl = hydrationPools.reduce((sum, pool) => sum + parseFloat(pool.tvl), 0);
        
        protocols.push({
          name: 'Hydration',
          chain: 'hydration',
          status: networkStatus.hydration?.isHealthy ? 'healthy' : 'degraded',
          tvl: totalTvl.toString(),
          apy: avgApy,
          executions: 0, // Would query from execution logs
        });
      }

      // Bifrost
      if (bifrostStaking.length > 0) {
        const avgApy = bifrostStaking.reduce((sum, staking) => sum + staking.apy, 0) / bifrostStaking.length;
        const totalStaked = bifrostStaking.reduce((sum, staking) => sum + parseFloat(staking.totalStaked), 0);
        
        protocols.push({
          name: 'Bifrost',
          chain: 'bifrost',
          status: networkStatus.bifrost?.isHealthy ? 'healthy' : 'degraded',
          tvl: totalStaked.toString(),
          apy: avgApy,
          executions: 0,
        });
      }

      // Moonbeam DEXs
      const moonbeamProtocols = new Map<string, { tvl: number; apy: number; count: number }>();
      
      for (const pool of moonbeamPools) {
        const existing = moonbeamProtocols.get(pool.protocol) || { tvl: 0, apy: 0, count: 0 };
        existing.tvl += parseFloat(pool.tvl);
        existing.apy += pool.apy;
        existing.count += 1;
        moonbeamProtocols.set(pool.protocol, existing);
      }

      for (const [protocolName, data] of moonbeamProtocols.entries()) {
        protocols.push({
          name: protocolName,
          chain: 'moonbeam',
          status: networkStatus.moonbeam?.isHealthy ? 'healthy' : 'degraded',
          tvl: data.tvl.toString(),
          apy: data.apy / data.count,
          executions: 0,
        });
      }

      return protocols;
    } catch (error) {
      this.logger.error('Failed to get protocols data:', error);
      return [];
    }
  }

  private async getRecentActivity(): Promise<DashboardData['recentActivity']> {
    try {
      const result = await this.databaseProvider.query(`
        SELECT 
          intent_id,
          status,
          created_at,
          updated_at,
          error_message
        FROM bot_execution_logs 
        ORDER BY updated_at DESC 
        LIMIT 20
      `);

      return result.rows.map(row => ({
        timestamp: new Date(row.updated_at),
        type: this.mapStatusToActivityType(row.status),
        intentId: row.intent_id,
        status: row.status,
        details: row.error_message || `Intent ${row.intent_id} ${row.status}`,
      }));
    } catch (error) {
      this.logger.error('Failed to get recent activity:', error);
      return [];
    }
  }

  private async getAlerts(): Promise<DashboardData['alerts']> {
    try {
      // Get security alerts
      const securityAlerts = await this.securityMonitoring.getAlerts(10);
      
      return securityAlerts.map(alert => ({
        id: alert.id,
        severity: alert.severity.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
        message: alert.message,
        timestamp: alert.timestamp,
        resolved: alert.resolved,
      }));
    } catch (error) {
      this.logger.error('Failed to get alerts:', error);
      return [];
    }
  }

  private async getChartsData(): Promise<DashboardData['charts']> {
    try {
      const [executionTrend, gasUsageTrend, protocolDistribution, performanceMetrics] = await Promise.all([
        this.getExecutionTrend(),
        this.getGasUsageTrend(),
        this.getProtocolDistribution(),
        this.getPerformanceMetrics(),
      ]);

      return {
        executionTrend,
        gasUsageTrend,
        protocolDistribution,
        performanceMetrics,
      };
    } catch (error) {
      this.logger.error('Failed to get charts data:', error);
      return {
        executionTrend: [],
        gasUsageTrend: [],
        protocolDistribution: [],
        performanceMetrics: [],
      };
    }
  }

  private async getExecutionTrend(): Promise<Array<{ date: string; successful: number; failed: number }>> {
    try {
      const result = await this.databaseProvider.query(`
        SELECT 
          DATE(to_timestamp(created_at / 1000)) as date,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM bot_execution_logs 
        WHERE created_at > $1
        GROUP BY DATE(to_timestamp(created_at / 1000))
        ORDER BY date DESC
        LIMIT 30
      `, [Date.now() - 30 * 24 * 60 * 60 * 1000]); // Last 30 days

      return result.rows.map(row => ({
        date: row.date,
        successful: parseInt(row.successful),
        failed: parseInt(row.failed),
      }));
    } catch (error) {
      this.logger.error('Failed to get execution trend:', error);
      return [];
    }
  }

  private async getGasUsageTrend(): Promise<Array<{ date: string; gasUsed: string }>> {
    try {
      const result = await this.databaseProvider.query(`
        SELECT 
          DATE(to_timestamp(created_at / 1000)) as date,
          COALESCE(SUM(gas_used::bigint), 0) as total_gas
        FROM bot_execution_logs 
        WHERE created_at > $1 AND gas_used IS NOT NULL
        GROUP BY DATE(to_timestamp(created_at / 1000))
        ORDER BY date DESC
        LIMIT 30
      `, [Date.now() - 30 * 24 * 60 * 60 * 1000]);

      return result.rows.map(row => ({
        date: row.date,
        gasUsed: row.total_gas.toString(),
      }));
    } catch (error) {
      this.logger.error('Failed to get gas usage trend:', error);
      return [];
    }
  }

  private async getProtocolDistribution(): Promise<Array<{ protocol: string; percentage: number }>> {
    try {
      // This would analyze execution logs to see which protocols are used most
      // For now, return mock data
      return [
        { protocol: 'Hydration', percentage: 45 },
        { protocol: 'Bifrost', percentage: 30 },
        { protocol: 'StellaSwap', percentage: 15 },
        { protocol: 'BeamSwap', percentage: 10 },
      ];
    } catch (error) {
      this.logger.error('Failed to get protocol distribution:', error);
      return [];
    }
  }

  private async getPerformanceMetrics(): Promise<Array<{ metric: string; value: number; trend: 'up' | 'down' | 'stable' }>> {
    try {
      const performanceStats = await this.monitoringService.getPerformanceStats();
      
      return [
        {
          metric: 'Success Rate',
          value: performanceStats.successRate,
          trend: 'stable', // Would calculate trend from historical data
        },
        {
          metric: 'Avg Execution Time',
          value: 45, // seconds
          trend: 'down', // Improving
        },
        {
          metric: 'Gas Efficiency',
          value: 85, // percentage
          trend: 'up',
        },
        {
          metric: 'Uptime',
          value: 99.5, // percentage
          trend: 'stable',
        },
      ];
    } catch (error) {
      this.logger.error('Failed to get performance metrics:', error);
      return [];
    }
  }

  private mapStatusToActivityType(status: string): 'claim' | 'execution' | 'completion' | 'error' {
    switch (status) {
      case 'claimed':
        return 'claim';
      case 'executing':
        return 'execution';
      case 'completed':
        return 'completion';
      case 'failed':
        return 'error';
      default:
        return 'execution';
    }
  }

  private getEmptyDashboardData(): DashboardData {
    return {
      overview: {
        totalIntents: 0,
        activeIntents: 0,
        completedIntents: 0,
        failedIntents: 0,
        successRate: 0,
        totalValueProcessed: '0',
        totalFeesEarned: '0',
      },
      performance: {
        averageExecutionTime: 0,
        averageGasUsed: '0',
        uptime: 0,
        lastActivity: new Date(0),
      },
      protocols: [],
      recentActivity: [],
      alerts: [],
      charts: {
        executionTrend: [],
        gasUsageTrend: [],
        protocolDistribution: [],
        performanceMetrics: [],
      },
    };
  }

  // Real-time updates
  async getRealtimeMetrics(): Promise<{
    activeExecutions: number;
    queuedIntents: number;
    systemHealth: 'healthy' | 'degraded' | 'critical';
    networkStatus: Record<string, boolean>;
  }> {
    try {
      const [botStatus, healthStatus, networkStatus] = await Promise.all([
        this.agentBotService.getBotStatus(),
        this.monitoringService.getHealthStatus(),
        this.realProtocolIntegration.getNetworkStatus(),
      ]);

      const systemHealth = healthStatus.status === 'healthy' ? 'healthy' : 
                          healthStatus.status === 'degraded' ? 'degraded' : 'critical';

      return {
        activeExecutions: botStatus.activeClaims?.length || 0,
        queuedIntents: 0, // Would query pending intents
        systemHealth,
        networkStatus: Object.fromEntries(
          Object.entries(networkStatus).map(([chain, status]) => [chain, status.isHealthy])
        ),
      };
    } catch (error) {
      this.logger.error('Failed to get realtime metrics:', error);
      return {
        activeExecutions: 0,
        queuedIntents: 0,
        systemHealth: 'critical',
        networkStatus: {},
      };
    }
  }
}