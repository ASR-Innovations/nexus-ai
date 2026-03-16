import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractService } from '../contract.service';
import { RedisService } from '../redis.service';
import { SecurityError, SECURITY_ERRORS, CONTRACT_CONSTANTS } from '../types/contract.types';

export interface DeadlineValidationResult {
  isValid: boolean;
  adjustedDeadline: number;
  safetyMarginApplied: number;
  errors: SecurityError[];
  warnings: string[];
}

export interface DeadlinePriorityInfo {
  intentId: bigint;
  deadline: number;
  timeRemaining: number;
  priorityScore: number;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface DeadlineConfig {
  safetyMarginSeconds: number;
  minExecutionTimeSeconds: number;
  maxDeadlineExtensionSeconds: number;
  priorityThresholds: {
    high: number; // seconds
    critical: number; // seconds
  };
}

@Injectable()
export class DeadlineManagementService {
  private readonly logger = new Logger(DeadlineManagementService.name);
  private readonly defaultConfig: DeadlineConfig = {
    safetyMarginSeconds: CONTRACT_CONSTANTS.EXECUTION_BUFFER, // 5 minutes
    minExecutionTimeSeconds: 60, // 1 minute minimum
    maxDeadlineExtensionSeconds: 3600, // 1 hour max extension
    priorityThresholds: {
      high: 600, // 10 minutes
      critical: 300, // 5 minutes
    },
  };

  constructor(
    private contractService: ContractService,
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  /**
   * Applies 5-minute safety margin to execution deadlines
   * Requirements: 8.1 - 5-minute safety margin to execution deadlines
   */
  async applySafetyMargin(originalDeadline: number): Promise<DeadlineValidationResult> {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];
    const config = this.getDeadlineConfig();

    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilDeadline = originalDeadline - currentTime;

      // Check if deadline is in the past
      if (originalDeadline <= currentTime) {
        errors.push({
          ...SECURITY_ERRORS.INSUFFICIENT_TIME_BEFORE_DEADLINE,
          message: 'Deadline is in the past',
          details: { 
            originalDeadline, 
            currentTime,
            timeDifference: timeUntilDeadline 
          }
        });
      }

      // Check if there's enough time for safe execution
      const requiredTime = config.safetyMarginSeconds + config.minExecutionTimeSeconds;
      if (timeUntilDeadline < requiredTime) {
        errors.push({
          ...SECURITY_ERRORS.INSUFFICIENT_TIME_BEFORE_DEADLINE,
          message: `Insufficient time before deadline. Need at least ${requiredTime} seconds, have ${timeUntilDeadline} seconds`,
          details: {
            originalDeadline,
            currentTime,
            timeUntilDeadline,
            requiredTime,
            safetyMargin: config.safetyMarginSeconds,
            minExecutionTime: config.minExecutionTimeSeconds
          }
        });
      }

      // Calculate adjusted deadline with safety margin
      const adjustedDeadline = originalDeadline - config.safetyMarginSeconds;

      // Generate warnings for tight deadlines
      if (timeUntilDeadline < config.priorityThresholds.high && timeUntilDeadline >= requiredTime) {
        warnings.push(`Tight deadline: only ${Math.floor(timeUntilDeadline / 60)} minutes remaining`);
      }

      if (timeUntilDeadline < config.priorityThresholds.critical && timeUntilDeadline >= requiredTime) {
        warnings.push(`Critical deadline: only ${timeUntilDeadline} seconds remaining`);
      }

      return {
        isValid: errors.length === 0,
        adjustedDeadline,
        safetyMarginApplied: config.safetyMarginSeconds,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error('Failed to apply safety margin:', error);
      return {
        isValid: false,
        adjustedDeadline: originalDeadline,
        safetyMarginApplied: 0,
        errors: [{
          code: 'DEADLINE_PROCESSING_FAILED',
          message: 'Internal error during deadline processing',
          details: { error: error instanceof Error ? error.message : String(error) },
          retryable: true
        }],
        warnings: []
      };
    }
  }

  /**
   * Validates that execution deadlines are realistic and achievable
   * Requirements: 8.2 - Deadline validation and prioritization
   */
  async validateExecutionDeadline(
    deadline: number,
    estimatedExecutionTime?: number
  ): Promise<DeadlineValidationResult> {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];
    const config = this.getDeadlineConfig();

    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilDeadline = deadline - currentTime;

      // Basic validation
      if (deadline <= currentTime) {
        errors.push({
          ...SECURITY_ERRORS.INSUFFICIENT_TIME_BEFORE_DEADLINE,
          message: 'Deadline cannot be in the past',
          details: { deadline, currentTime }
        });
      }

      // Check minimum execution time
      const minRequiredTime = config.safetyMarginSeconds + config.minExecutionTimeSeconds;
      if (timeUntilDeadline < minRequiredTime) {
        errors.push({
          ...SECURITY_ERRORS.INSUFFICIENT_TIME_BEFORE_DEADLINE,
          message: `Deadline too soon. Minimum ${minRequiredTime} seconds required`,
          details: { 
            deadline, 
            currentTime, 
            timeUntilDeadline, 
            minRequiredTime 
          }
        });
      }

      // Validate against estimated execution time if provided
      if (estimatedExecutionTime) {
        const totalRequiredTime = estimatedExecutionTime + config.safetyMarginSeconds;
        if (timeUntilDeadline < totalRequiredTime) {
          errors.push({
            ...SECURITY_ERRORS.INSUFFICIENT_TIME_BEFORE_DEADLINE,
            message: `Insufficient time for estimated execution (${estimatedExecutionTime}s) plus safety margin`,
            details: {
              deadline,
              currentTime,
              timeUntilDeadline,
              estimatedExecutionTime,
              safetyMargin: config.safetyMarginSeconds,
              totalRequiredTime
            }
          });
        }
      }

      // Check for unreasonably far deadlines (more than 24 hours)
      const maxReasonableDeadline = 24 * 60 * 60; // 24 hours
      if (timeUntilDeadline > maxReasonableDeadline) {
        warnings.push(`Deadline is very far in the future (${Math.floor(timeUntilDeadline / 3600)} hours)`);
      }

      // Apply safety margin
      const adjustedDeadline = deadline - config.safetyMarginSeconds;

      return {
        isValid: errors.length === 0,
        adjustedDeadline,
        safetyMarginApplied: config.safetyMarginSeconds,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error('Failed to validate execution deadline:', error);
      return {
        isValid: false,
        adjustedDeadline: deadline,
        safetyMarginApplied: 0,
        errors: [{
          code: 'DEADLINE_VALIDATION_FAILED',
          message: 'Internal error during deadline validation',
          details: { error: error instanceof Error ? error.message : String(error) },
          retryable: true
        }],
        warnings: []
      };
    }
  }

  /**
   * Prioritizes intent execution based on approaching deadlines
   * Requirements: 8.3 - Deadline prioritization
   */
  async prioritizeIntentsByDeadline(intentIds: bigint[]): Promise<DeadlinePriorityInfo[]> {
    const priorityInfos: DeadlinePriorityInfo[] = [];
    const config = this.getDeadlineConfig();
    const currentTime = Math.floor(Date.now() / 1000);

    try {
      for (const intentId of intentIds) {
        try {
          const intent = await this.contractService.getIntent(intentId);
          const deadline = Number(intent.deadline);
          const timeRemaining = deadline - currentTime;

          // Calculate priority score (higher score = higher priority)
          let priorityScore = 0;
          let urgencyLevel: DeadlinePriorityInfo['urgencyLevel'] = 'LOW';

          if (timeRemaining <= 0) {
            priorityScore = 1000; // Highest priority for expired intents
            urgencyLevel = 'CRITICAL';
          } else if (timeRemaining <= config.priorityThresholds.critical) {
            priorityScore = 900 + (config.priorityThresholds.critical - timeRemaining);
            urgencyLevel = 'CRITICAL';
          } else if (timeRemaining <= config.priorityThresholds.high) {
            priorityScore = 500 + (config.priorityThresholds.high - timeRemaining) / 10;
            urgencyLevel = 'HIGH';
          } else if (timeRemaining <= config.priorityThresholds.high * 2) {
            priorityScore = 100 + (config.priorityThresholds.high * 2 - timeRemaining) / 100;
            urgencyLevel = 'MEDIUM';
          } else {
            priorityScore = Math.max(1, 100 - timeRemaining / 3600); // Decrease priority over time
            urgencyLevel = 'LOW';
          }

          priorityInfos.push({
            intentId,
            deadline,
            timeRemaining,
            priorityScore,
            urgencyLevel
          });

        } catch (error) {
          this.logger.error(`Failed to get priority info for intent ${intentId}:`, error);
          // Add with lowest priority if we can't get info
          priorityInfos.push({
            intentId,
            deadline: 0,
            timeRemaining: 0,
            priorityScore: 0,
            urgencyLevel: 'LOW'
          });
        }
      }

      // Sort by priority score (highest first)
      return priorityInfos.sort((a, b) => b.priorityScore - a.priorityScore);

    } catch (error) {
      this.logger.error('Failed to prioritize intents by deadline:', error);
      return [];
    }
  }

  /**
   * Handles timeout scenarios for exceeded deadlines
   * Requirements: 8.4 - Timeout handling for exceeded deadlines
   */
  async handleDeadlineTimeout(intentId: bigint): Promise<{
    action: 'CANCEL' | 'EXTEND' | 'FORCE_EXECUTE' | 'NOTIFY_ONLY';
    reason: string;
    newDeadline?: number;
    details: Record<string, any>;
  }> {
    try {
      const intent = await this.contractService.getIntent(intentId);
      const currentTime = Math.floor(Date.now() / 1000);
      const deadline = Number(intent.deadline);
      const timeOverdue = currentTime - deadline;

      this.logger.warn(`Intent ${intentId} deadline exceeded by ${timeOverdue} seconds`);

      // Store timeout event for monitoring
      await this.recordTimeoutEvent(intentId, timeOverdue);

      // Determine action based on how long overdue and intent status
      if (timeOverdue < 300) { // Less than 5 minutes overdue
        // Try to extend deadline if possible
        const config = this.getDeadlineConfig();
        const extensionTime = Math.min(timeOverdue * 2, config.maxDeadlineExtensionSeconds);
        const newDeadline = currentTime + extensionTime;

        return {
          action: 'EXTEND',
          reason: `Intent slightly overdue (${timeOverdue}s), extending deadline`,
          newDeadline,
          details: {
            originalDeadline: deadline,
            timeOverdue,
            extensionTime,
            newDeadline
          }
        };
      } else if (timeOverdue < 1800) { // Less than 30 minutes overdue
        // Cancel the intent
        return {
          action: 'CANCEL',
          reason: `Intent significantly overdue (${Math.floor(timeOverdue / 60)} minutes), cancelling`,
          details: {
            originalDeadline: deadline,
            timeOverdue,
            overdueMinutes: Math.floor(timeOverdue / 60)
          }
        };
      } else {
        // Just notify - intent is too old to take action
        return {
          action: 'NOTIFY_ONLY',
          reason: `Intent severely overdue (${Math.floor(timeOverdue / 3600)} hours), notification only`,
          details: {
            originalDeadline: deadline,
            timeOverdue,
            overdueHours: Math.floor(timeOverdue / 3600)
          }
        };
      }

    } catch (error) {
      this.logger.error(`Failed to handle deadline timeout for intent ${intentId}:`, error);
      return {
        action: 'NOTIFY_ONLY',
        reason: 'Error handling timeout',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Records timeout events for monitoring and alerting
   */
  private async recordTimeoutEvent(intentId: bigint, timeOverdue: number): Promise<void> {
    try {
      const timeoutEvent = {
        intentId: intentId.toString(),
        timeOverdue,
        timestamp: Date.now(),
        type: 'DEADLINE_TIMEOUT'
      };

      // Store in Redis for monitoring
      const key = `timeout_events:${Date.now()}:${intentId}`;
      await this.redisService.setex(key, 86400, JSON.stringify(timeoutEvent)); // 24 hour TTL

      // Also add to a sorted set for easy querying
      await this.redisService.zadd('timeout_events_by_time', Date.now(), key);

    } catch (error) {
      this.logger.error('Failed to record timeout event:', error);
    }
  }

  /**
   * Gets deadline configuration from config service
   */
  private getDeadlineConfig(): DeadlineConfig {
    return {
      safetyMarginSeconds: this.configService.get('deadline.safetyMarginSeconds', this.defaultConfig.safetyMarginSeconds),
      minExecutionTimeSeconds: this.configService.get('deadline.minExecutionTimeSeconds', this.defaultConfig.minExecutionTimeSeconds),
      maxDeadlineExtensionSeconds: this.configService.get('deadline.maxDeadlineExtensionSeconds', this.defaultConfig.maxDeadlineExtensionSeconds),
      priorityThresholds: {
        high: this.configService.get('deadline.priorityThresholds.high', this.defaultConfig.priorityThresholds.high),
        critical: this.configService.get('deadline.priorityThresholds.critical', this.defaultConfig.priorityThresholds.critical),
      },
    };
  }

  /**
   * Creates descriptive error messages for deadline violations
   */
  createDeadlineError(
    type: 'EXPIRED' | 'TOO_SOON' | 'INVALID' | 'PROCESSING_FAILED',
    details: Record<string, any>
  ): SecurityError {
    switch (type) {
      case 'EXPIRED':
        return {
          code: 'DEADLINE_EXPIRED',
          message: `Execution deadline has passed (overdue by ${details.timeOverdue} seconds)`,
          details,
          retryable: false,
          suggestedAction: 'Create a new intent with a future deadline'
        };
      
      case 'TOO_SOON':
        return {
          code: 'DEADLINE_TOO_SOON',
          message: `Deadline is too soon for safe execution (need ${details.requiredTime}s, have ${details.availableTime}s)`,
          details,
          retryable: false,
          suggestedAction: 'Set a deadline further in the future to allow for safe execution'
        };
      
      case 'INVALID':
        return {
          code: 'INVALID_DEADLINE',
          message: 'Invalid deadline parameters provided',
          details,
          retryable: false,
          suggestedAction: 'Check deadline format and ensure it is a valid future timestamp'
        };
      
      case 'PROCESSING_FAILED':
        return {
          code: 'DEADLINE_PROCESSING_FAILED',
          message: 'Failed to process deadline requirements',
          details,
          retryable: true,
          suggestedAction: 'Retry the operation or contact support if the issue persists'
        };
      
      default:
        return {
          code: 'UNKNOWN_DEADLINE_ERROR',
          message: 'Unknown deadline management error',
          details,
          retryable: true
        };
    }
  }

  /**
   * Gets timeout statistics for monitoring
   */
  async getTimeoutStatistics(hoursBack: number = 24): Promise<{
    totalTimeouts: number;
    averageOverdueTime: number;
    timeoutsByUrgency: Record<string, number>;
    recentTimeouts: Array<{ intentId: string; timeOverdue: number; timestamp: number }>;
  }> {
    try {
      const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
      
      // Get recent timeout events
      const timeoutKeys = await this.redisService.zrangebyscore(
        'timeout_events_by_time',
        cutoffTime,
        Date.now()
      );

      const timeouts = [];
      let totalOverdueTime = 0;
      const timeoutsByUrgency = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };

      for (const key of timeoutKeys) {
        try {
          const eventData = await this.redisService.get(key);
          if (eventData) {
            const event = JSON.parse(eventData);
            timeouts.push(event);
            totalOverdueTime += event.timeOverdue;

            // Categorize by urgency
            if (event.timeOverdue < 300) timeoutsByUrgency.LOW++;
            else if (event.timeOverdue < 900) timeoutsByUrgency.MEDIUM++;
            else if (event.timeOverdue < 1800) timeoutsByUrgency.HIGH++;
            else timeoutsByUrgency.CRITICAL++;
          }
        } catch (error) {
          this.logger.error(`Failed to parse timeout event ${key}:`, error);
        }
      }

      return {
        totalTimeouts: timeouts.length,
        averageOverdueTime: timeouts.length > 0 ? totalOverdueTime / timeouts.length : 0,
        timeoutsByUrgency,
        recentTimeouts: timeouts.slice(-10) // Last 10 timeouts
      };

    } catch (error) {
      this.logger.error('Failed to get timeout statistics:', error);
      return {
        totalTimeouts: 0,
        averageOverdueTime: 0,
        timeoutsByUrgency: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        recentTimeouts: []
      };
    }
  }
}