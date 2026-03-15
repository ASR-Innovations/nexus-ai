import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { SecurityConfigService } from './security-config.service';

export interface SecurityMetrics {
  // Rate limiting metrics
  rateLimitViolations: number;
  activeIntentCounts: Record<string, number>;
  
  // Reputation metrics
  reputationChanges: number;
  lowReputationBlocks: number;
  
  // Timelock metrics
  timelockOperationsCreated: number;
  timelockOperationsExecuted: number;
  timelockOperationsCancelled: number;
  
  // Emergency pause metrics
  emergencyPauseActivations: number;
  pauseDurationMs: number;
  operationsBlockedDuringPause: number;
  
  // Slippage protection metrics
  slippageViolations: number;
  dynamicSlippageCalculations: number;
  
  // XCM validation metrics
  xcmValidationAttempts: number;
  xcmValidationFailures: number;
  
  // Protocol whitelist metrics
  whitelistViolations: number;
  whitelistCacheHits: number;
  whitelistCacheMisses: number;
  
  // General security metrics
  securityChecksPerformed: number;
  securityCheckFailures: number;
  
  // Performance metrics
  averageSecurityCheckDurationMs: number;
  securityServiceErrors: number;
}

export interface SecurityAlert {
  id: string;
  type: 'RATE_LIMIT' | 'REPUTATION' | 'EMERGENCY_PAUSE' | 'SLIPPAGE' | 'XCM' | 'WHITELIST' | 'SYSTEM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

@Injectable()
export class SecurityMonitoringService {
  private readonly logger = new Logger(SecurityMonitoringService.name);
  private readonly METRICS_KEY = 'security:metrics';
  private readonly ALERTS_KEY = 'security:alerts';
  private readonly EVENTS_KEY = 'security:events';

  constructor(
    private redisService: RedisService,
    private securityConfigService: SecurityConfigService,
  ) {}

  // Metrics Collection
  async recordRateLimitViolation(agentAddress: string, currentCount: number): Promise<void> {
    try {
      await this.incrementMetric('rateLimitViolations');
      await this.recordEvent('RATE_LIMIT_VIOLATION', {
        agentAddress,
        currentCount,
        maxAllowed: await this.securityConfigService.getMaxActiveIntents()
      });

      // Create alert for repeated violations
      const recentViolations = await this.getRecentEventCount('RATE_LIMIT_VIOLATION', agentAddress, 3600000); // 1 hour
      if (recentViolations >= 3) {
        await this.createAlert('RATE_LIMIT', 'HIGH', 
          `Agent ${agentAddress} has ${recentViolations} rate limit violations in the last hour`,
          { agentAddress, violationCount: recentViolations }
        );
      }
    } catch (error) {
      this.logger.error('Failed to record rate limit violation:', error);
    }
  }

  async recordReputationChange(agentAddress: string, oldScore: number, newScore: number, reason: string): Promise<void> {
    try {
      await this.incrementMetric('reputationChanges');
      await this.recordEvent('REPUTATION_CHANGE', {
        agentAddress,
        oldScore,
        newScore,
        change: newScore - oldScore,
        reason
      });

      // Alert on significant reputation drops
      const change = newScore - oldScore;
      if (change < -1000) { // Drop of more than 10%
        await this.createAlert('REPUTATION', 'MEDIUM',
          `Agent ${agentAddress} reputation dropped by ${Math.abs(change)} points`,
          { agentAddress, change, reason }
        );
      }
    } catch (error) {
      this.logger.error('Failed to record reputation change:', error);
    }
  }

  async recordTimelockOperation(operationType: string, operationId: string, action: 'CREATED' | 'EXECUTED' | 'CANCELLED'): Promise<void> {
    try {
      const metricKey = `timelockOperations${action.charAt(0) + action.slice(1).toLowerCase()}`;
      await this.incrementMetric(metricKey);
      await this.recordEvent('TIMELOCK_OPERATION', {
        operationType,
        operationId,
        action
      });
    } catch (error) {
      this.logger.error('Failed to record timelock operation:', error);
    }
  }

  async recordEmergencyPause(contract: string, duration?: number): Promise<void> {
    try {
      await this.incrementMetric('emergencyPauseActivations');
      if (duration) {
        await this.updateMetric('pauseDurationMs', duration);
      }
      
      await this.recordEvent('EMERGENCY_PAUSE', { contract, duration });
      
      // Always create critical alert for emergency pause
      await this.createAlert('EMERGENCY_PAUSE', 'CRITICAL',
        `Emergency pause activated for ${contract}`,
        { contract, duration }
      );
    } catch (error) {
      this.logger.error('Failed to record emergency pause:', error);
    }
  }

  async recordSlippageViolation(agentAddress: string, expectedSlippage: number, actualSlippage: number): Promise<void> {
    try {
      await this.incrementMetric('slippageViolations');
      await this.recordEvent('SLIPPAGE_VIOLATION', {
        agentAddress,
        expectedSlippage,
        actualSlippage,
        difference: actualSlippage - expectedSlippage
      });

      if (actualSlippage > expectedSlippage * 2) { // More than double expected slippage
        await this.createAlert('SLIPPAGE', 'HIGH',
          `Severe slippage violation: ${actualSlippage}% vs expected ${expectedSlippage}%`,
          { agentAddress, expectedSlippage, actualSlippage }
        );
      }
    } catch (error) {
      this.logger.error('Failed to record slippage violation:', error);
    }
  }

  async recordXCMValidation(success: boolean, paraId?: number, errors?: string[]): Promise<void> {
    try {
      await this.incrementMetric('xcmValidationAttempts');
      if (!success) {
        await this.incrementMetric('xcmValidationFailures');
      }
      
      await this.recordEvent('XCM_VALIDATION', {
        success,
        paraId,
        errors
      });

      // Alert on high failure rate
      const attempts = await this.getMetric('xcmValidationAttempts');
      const failures = await this.getMetric('xcmValidationFailures');
      const failureRate = attempts > 0 ? (failures / attempts) * 100 : 0;
      
      if (attempts > 10 && failureRate > 50) {
        await this.createAlert('XCM', 'HIGH',
          `High XCM validation failure rate: ${failureRate.toFixed(1)}%`,
          { attempts, failures, failureRate }
        );
      }
    } catch (error) {
      this.logger.error('Failed to record XCM validation:', error);
    }
  }

  async recordWhitelistViolation(agentAddress: string, protocol: string): Promise<void> {
    try {
      await this.incrementMetric('whitelistViolations');
      await this.recordEvent('WHITELIST_VIOLATION', {
        agentAddress,
        protocol
      });
    } catch (error) {
      this.logger.error('Failed to record whitelist violation:', error);
    }
  }

  async recordSecurityEvent(event: {
    type: string;
    category?: string;
    code?: string;
    message?: string;
    details?: any;
    context?: any;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.recordEvent(event.type, {
        category: event.category,
        code: event.code,
        message: event.message,
        details: event.details,
        context: event.context,
        timestamp: event.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to record security event:', error);
    }
  }

  async getSecurityMetrics(): Promise<{
    totalSecurityEvents: number;
    errorsByCategory: Record<string, number>;
    rateLimitViolations: number;
    timelockOperationsToday: number;
    emergencyPauseActivations: number;
  }> {
    try {
      const metrics = await this.getMetrics();
      
      return {
        totalSecurityEvents: metrics.securityChecksPerformed,
        errorsByCategory: {
          TIMELOCK: metrics.timelockOperationsCreated + metrics.timelockOperationsExecuted + metrics.timelockOperationsCancelled,
          RATE_LIMIT: metrics.rateLimitViolations,
          REPUTATION: metrics.reputationChanges,
          EMERGENCY_PAUSE: metrics.emergencyPauseActivations,
          PROTOCOL_VALIDATION: metrics.whitelistViolations,
          XCM_VALIDATION: metrics.xcmValidationFailures,
          SLIPPAGE_PROTECTION: metrics.slippageViolations,
          DEADLINE_MANAGEMENT: 0, // Add if needed
          CONTRACT_REVERSION: 0, // Add if needed
          CONFIGURATION: 0 // Add if needed
        },
        rateLimitViolations: metrics.rateLimitViolations,
        timelockOperationsToday: metrics.timelockOperationsCreated + metrics.timelockOperationsExecuted + metrics.timelockOperationsCancelled,
        emergencyPauseActivations: metrics.emergencyPauseActivations
      };
    } catch (error) {
      this.logger.error('Failed to get security metrics:', error);
      return {
        totalSecurityEvents: 0,
        errorsByCategory: {},
        rateLimitViolations: 0,
        timelockOperationsToday: 0,
        emergencyPauseActivations: 0
      };
    }
  }

  async recordSecurityCheck(success: boolean, durationMs: number, errors?: string[]): Promise<void> {
    try {
      await this.incrementMetric('securityChecksPerformed');
      if (!success) {
        await this.incrementMetric('securityCheckFailures');
      }
      
      // Update average duration
      const currentAvg = await this.getMetric('averageSecurityCheckDurationMs') || 0;
      const currentCount = await this.getMetric('securityChecksPerformed');
      const newAvg = ((currentAvg * (currentCount - 1)) + durationMs) / currentCount;
      await this.setMetric('averageSecurityCheckDurationMs', Math.round(newAvg));

      // Alert on slow security checks
      if (durationMs > 5000) { // More than 5 seconds
        await this.createAlert('SYSTEM', 'MEDIUM',
          `Slow security check detected: ${durationMs}ms`,
          { durationMs, success, errors }
        );
      }
    } catch (error) {
      this.logger.error('Failed to record security check:', error);
    }
  }

  // Metrics Retrieval
  async getMetrics(): Promise<SecurityMetrics> {
    try {
      // Use simple key-value pairs instead of hash for now
      const keys = [
        'rateLimitViolations', 'reputationChanges', 'lowReputationBlocks',
        'timelockOperationsCreated', 'timelockOperationsExecuted', 'timelockOperationsCancelled',
        'emergencyPauseActivations', 'pauseDurationMs', 'operationsBlockedDuringPause',
        'slippageViolations', 'dynamicSlippageCalculations', 'xcmValidationAttempts',
        'xcmValidationFailures', 'whitelistViolations', 'whitelistCacheHits',
        'whitelistCacheMisses', 'securityChecksPerformed', 'securityCheckFailures',
        'averageSecurityCheckDurationMs', 'securityServiceErrors'
      ];
      
      const values = await Promise.all(
        keys.map(key => this.redisService.get(`${this.METRICS_KEY}:${key}`))
      );
      
      const metricsData: Record<string, string> = {};
      keys.forEach((key, index) => {
        metricsData[key] = values[index] || '0';
      });
      
      return {
        rateLimitViolations: parseInt(metricsData.rateLimitViolations || '0'),
        activeIntentCounts: {}, // Simplified for now
        reputationChanges: parseInt(metricsData.reputationChanges || '0'),
        lowReputationBlocks: parseInt(metricsData.lowReputationBlocks || '0'),
        timelockOperationsCreated: parseInt(metricsData.timelockOperationsCreated || '0'),
        timelockOperationsExecuted: parseInt(metricsData.timelockOperationsExecuted || '0'),
        timelockOperationsCancelled: parseInt(metricsData.timelockOperationsCancelled || '0'),
        emergencyPauseActivations: parseInt(metricsData.emergencyPauseActivations || '0'),
        pauseDurationMs: parseInt(metricsData.pauseDurationMs || '0'),
        operationsBlockedDuringPause: parseInt(metricsData.operationsBlockedDuringPause || '0'),
        slippageViolations: parseInt(metricsData.slippageViolations || '0'),
        dynamicSlippageCalculations: parseInt(metricsData.dynamicSlippageCalculations || '0'),
        xcmValidationAttempts: parseInt(metricsData.xcmValidationAttempts || '0'),
        xcmValidationFailures: parseInt(metricsData.xcmValidationFailures || '0'),
        whitelistViolations: parseInt(metricsData.whitelistViolations || '0'),
        whitelistCacheHits: parseInt(metricsData.whitelistCacheHits || '0'),
        whitelistCacheMisses: parseInt(metricsData.whitelistCacheMisses || '0'),
        securityChecksPerformed: parseInt(metricsData.securityChecksPerformed || '0'),
        securityCheckFailures: parseInt(metricsData.securityCheckFailures || '0'),
        averageSecurityCheckDurationMs: parseInt(metricsData.averageSecurityCheckDurationMs || '0'),
        securityServiceErrors: parseInt(metricsData.securityServiceErrors || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to get metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  async getAlerts(limit: number = 50, severity?: string): Promise<SecurityAlert[]> {
    try {
      // Simplified implementation - return empty array for now
      return [];
    } catch (error) {
      this.logger.error('Failed to get alerts:', error);
      return [];
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    try {
      const alertData = await this.redisService.get(`${this.ALERTS_KEY}:${alertId}`);
      if (alertData) {
        const alert = JSON.parse(alertData);
        alert.resolved = true;
        alert.resolvedAt = new Date();
        await this.redisService.set(`${this.ALERTS_KEY}:${alertId}`, JSON.stringify(alert));
      }
    } catch (error) {
      this.logger.error('Failed to resolve alert:', error);
    }
  }

  // Helper methods
  private async incrementMetric(key: string): Promise<void> {
    await this.redisService.incr(`${this.METRICS_KEY}:${key}`);
  }

  private async updateMetric(key: string, value: number): Promise<void> {
    await this.redisService.set(`${this.METRICS_KEY}:${key}`, value.toString());
  }

  private async setMetric(key: string, value: number): Promise<void> {
    await this.redisService.set(`${this.METRICS_KEY}:${key}`, value.toString());
  }

  private async getMetric(key: string): Promise<number> {
    const value = await this.redisService.get(`${this.METRICS_KEY}:${key}`);
    return value ? parseInt(value) : 0;
  }

  private async recordEvent(type: string, data: any): Promise<void> {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString()
    };
    
    // Use simple key-value storage for events (simplified)
    const eventKey = `${this.EVENTS_KEY}:${type}:${Date.now()}`;
    await this.redisService.set(eventKey, JSON.stringify(event), 3600); // 1 hour TTL
  }

  private async getRecentEventCount(type: string, agentAddress: string, timeWindowMs: number): Promise<number> {
    // Simplified implementation - return 0 for now
    return 0;
  }

  private async createAlert(type: SecurityAlert['type'], severity: SecurityAlert['severity'], message: string, details: any): Promise<void> {
    const alertId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: SecurityAlert = {
      id: alertId,
      type,
      severity,
      message,
      details,
      timestamp: new Date(),
      resolved: false
    };
    
    await this.redisService.set(`${this.ALERTS_KEY}:${alertId}`, JSON.stringify(alert), 86400); // 24 hours TTL
    
    this.logger.warn(`Security alert created: ${severity} - ${message}`, details);
  }

  private getEmptyMetrics(): SecurityMetrics {
    return {
      rateLimitViolations: 0,
      activeIntentCounts: {},
      reputationChanges: 0,
      lowReputationBlocks: 0,
      timelockOperationsCreated: 0,
      timelockOperationsExecuted: 0,
      timelockOperationsCancelled: 0,
      emergencyPauseActivations: 0,
      pauseDurationMs: 0,
      operationsBlockedDuringPause: 0,
      slippageViolations: 0,
      dynamicSlippageCalculations: 0,
      xcmValidationAttempts: 0,
      xcmValidationFailures: 0,
      whitelistViolations: 0,
      whitelistCacheHits: 0,
      whitelistCacheMisses: 0,
      securityChecksPerformed: 0,
      securityCheckFailures: 0,
      averageSecurityCheckDurationMs: 0,
      securityServiceErrors: 0,
    };
  }
}