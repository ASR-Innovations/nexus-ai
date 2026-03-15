/**
 * Security Service
 * 
 * Central coordinator for all security-related functionality including
 * timelock enforcement, rate limiting, reputation validation, and emergency pause handling.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TimelockManagerService } from './timelock-manager.service';
import { RateLimitService } from './rate-limit.service';
import { SlippageProtectionService } from './slippage-protection.service';
import { DeadlineManagementService } from './deadline-management.service';
import { ProtocolWhitelistService } from './protocol-whitelist.service';
import { XCMValidationService } from './xcm-validation.service';
import { SecurityConfigService } from './security-config.service';
import { SecurityMonitoringService } from './security-monitoring.service';
import { ContractService } from '../contract.service';
import {
  CreateTimelockOperationParams,
  TimelockOperationWithDetails
} from '../types/timelock.types';

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TimelockEnforcementResult {
  canExecute: boolean;
  reason?: string;
  timeRemaining?: number;
}

export interface SecurityErrorResponse {
  code: string;
  message: string;
  details: Record<string, any>;
  retryable: boolean;
  suggestedAction?: string;
  category: SecurityErrorCategory;
}

export enum SecurityErrorCategory {
  TIMELOCK = 'TIMELOCK',
  RATE_LIMIT = 'RATE_LIMIT',
  REPUTATION = 'REPUTATION',
  EMERGENCY_PAUSE = 'EMERGENCY_PAUSE',
  PROTOCOL_VALIDATION = 'PROTOCOL_VALIDATION',
  XCM_VALIDATION = 'XCM_VALIDATION',
  SLIPPAGE_PROTECTION = 'SLIPPAGE_PROTECTION',
  DEADLINE_MANAGEMENT = 'DEADLINE_MANAGEMENT',
  CONTRACT_REVERSION = 'CONTRACT_REVERSION',
  CONFIGURATION = 'CONFIGURATION'
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface SecurityOperationParams {
  agentAddress?: string;
  protocols?: string[];
  minReputation?: number;
  requiresTimelock?: boolean;
  timelockOperationId?: string;
  slippageParams?: any;
  deadline?: number;
  xcmMessage?: any;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  // Security error definitions
  private readonly SECURITY_ERRORS = {
    TIMELOCK_NOT_READY: {
      code: 'TIMELOCK_NOT_READY',
      message: 'Operation cannot be executed until timelock period expires',
      retryable: true,
      suggestedAction: 'Wait until the timelock period expires',
      category: SecurityErrorCategory.TIMELOCK
    },
    RATE_LIMIT_EXCEEDED: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Agent has reached maximum active intent limit of 10',
      retryable: false,
      suggestedAction: 'Complete or cancel existing intents before creating new ones',
      category: SecurityErrorCategory.RATE_LIMIT
    },
    INSUFFICIENT_REPUTATION: {
      code: 'INSUFFICIENT_REPUTATION',
      message: 'Agent reputation below required threshold',
      retryable: false,
      suggestedAction: 'Improve reputation through successful intent executions',
      category: SecurityErrorCategory.REPUTATION
    },
    EMERGENCY_PAUSE_ACTIVE: {
      code: 'EMERGENCY_PAUSE_ACTIVE',
      message: 'System is in emergency pause mode',
      retryable: true,
      suggestedAction: 'Wait for emergency pause to be deactivated',
      category: SecurityErrorCategory.EMERGENCY_PAUSE
    },
    PROTOCOL_NOT_WHITELISTED: {
      code: 'PROTOCOL_NOT_WHITELISTED',
      message: 'One or more protocols are not whitelisted',
      retryable: false,
      suggestedAction: 'Use only whitelisted protocols',
      category: SecurityErrorCategory.PROTOCOL_VALIDATION
    },
    XCM_VALIDATION_FAILED: {
      code: 'XCM_VALIDATION_FAILED',
      message: 'XCM message validation failed',
      retryable: false,
      suggestedAction: 'Check XCM message format and signatures',
      category: SecurityErrorCategory.XCM_VALIDATION
    },
    SLIPPAGE_EXCEEDED: {
      code: 'SLIPPAGE_EXCEEDED',
      message: 'Trade slippage exceeds configured limits',
      retryable: false,
      suggestedAction: 'Adjust slippage tolerance or wait for better market conditions',
      category: SecurityErrorCategory.SLIPPAGE_PROTECTION
    },
    DEADLINE_EXCEEDED: {
      code: 'DEADLINE_EXCEEDED',
      message: 'Execution deadline has been exceeded',
      retryable: false,
      suggestedAction: 'Create a new intent with a longer deadline',
      category: SecurityErrorCategory.DEADLINE_MANAGEMENT
    },
    CONTRACT_REVERTED: {
      code: 'CONTRACT_REVERTED',
      message: 'Smart contract execution reverted',
      retryable: true,
      suggestedAction: 'Check contract state and retry',
      category: SecurityErrorCategory.CONTRACT_REVERSION
    }
  };

  // Retry configuration
  private readonly RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    retryableErrors: [
      'TIMELOCK_NOT_READY',
      'EMERGENCY_PAUSE_ACTIVE',
      'CONTRACT_REVERTED',
      'NETWORK_ERROR',
      'CONTRACT_BUSY'
    ]
  };

  constructor(
    public readonly timelockManager: TimelockManagerService,
    public readonly rateLimitService: RateLimitService,
    private readonly slippageProtection: SlippageProtectionService,
    private readonly deadlineManagement: DeadlineManagementService,
    private readonly protocolWhitelist: ProtocolWhitelistService,
    private readonly xcmValidation: XCMValidationService,
    public readonly securityConfig: SecurityConfigService,
    public readonly securityMonitoring: SecurityMonitoringService,
    private readonly contractService: ContractService
  ) {}

  // ==================== TIMELOCK MANAGEMENT ====================

  /**
   * Schedule a timelock operation with 2-day delay
   */
  async scheduleTimelockOperation(operation: CreateTimelockOperationParams): Promise<string> {
    try {
      this.logger.log(`Scheduling timelock operation: ${operation.type}`);
      return await this.timelockManager.scheduleOperation(operation);
    } catch (error) {
      this.logger.error('Failed to schedule timelock operation:', error);
      throw error;
    }
  }

  /**
   * Execute a timelock operation with delay validation
   */
  async executeTimelockOperation(operationId: string): Promise<void> {
    try {
      // Validate timelock delay has passed
      const enforcement = await this.validateTimelockExecution(operationId);
      
      if (!enforcement.canExecute) {
        throw new Error(`Timelock execution denied: ${enforcement.reason}`);
      }

      this.logger.log(`Executing timelock operation: ${operationId}`);
      await this.timelockManager.executeOperation(operationId);
    } catch (error) {
      this.logger.error(`Failed to execute timelock operation ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * Get timelock operation status with execution availability
   */
  async getTimelockStatus(operationId: string): Promise<TimelockOperationWithDetails | null> {
    try {
      return await this.timelockManager.getOperationStatus(operationId);
    } catch (error) {
      this.logger.error(`Failed to get timelock status for ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * Validate if a timelock operation can be executed
   */
  async validateTimelockExecution(operationId: string): Promise<TimelockEnforcementResult> {
    try {
      const operation = await this.timelockManager.getOperationStatus(operationId);
      
      if (!operation) {
        return {
          canExecute: false,
          reason: 'Timelock operation not found'
        };
      }

      if (operation.status !== 'PENDING') {
        return {
          canExecute: false,
          reason: `Operation is not in PENDING status (current: ${operation.status})`
        };
      }

      const now = Date.now();
      const executeTime = operation.executeAt.getTime();
      
      if (now < executeTime) {
        const timeRemaining = executeTime - now;
        return {
          canExecute: false,
          reason: 'Timelock delay period has not elapsed',
          timeRemaining
        };
      }

      return {
        canExecute: true,
        timeRemaining: 0
      };
    } catch (error) {
      this.logger.error(`Failed to validate timelock execution for ${operationId}:`, error);
      return {
        canExecute: false,
        reason: `Validation error: ${(error as Error).message}`
      };
    }
  }

  /**
   * Validate delay period before allowing execution
   */
  async validateDelayPeriod(operationId: string, requiredDelayMs: number): Promise<boolean> {
    try {
      const operation = await this.timelockManager.getOperationStatus(operationId);
      
      if (!operation) {
        return false;
      }

      const actualDelay = operation.executeAt.getTime() - operation.scheduledAt.getTime();
      return actualDelay >= requiredDelayMs;
    } catch (error) {
      this.logger.error(`Failed to validate delay period for ${operationId}:`, error);
      return false;
    }
  }

  /**
   * Check execution availability for timelock operations
   */
  async checkExecutionAvailability(operationId: string): Promise<{
    available: boolean;
    reason?: string;
    availableAt?: Date;
  }> {
    try {
      const operation = await this.timelockManager.getOperationStatus(operationId);
      
      if (!operation) {
        return {
          available: false,
          reason: 'Operation not found'
        };
      }

      if (operation.canExecute) {
        return {
          available: true
        };
      }

      return {
        available: false,
        reason: 'Timelock delay period not yet elapsed',
        availableAt: operation.executeAt
      };
    } catch (error) {
      this.logger.error(`Failed to check execution availability for ${operationId}:`, error);
      return {
        available: false,
        reason: `Check failed: ${(error as Error).message}`
      };
    }
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check if agent is within rate limits
   */
  async checkAgentRateLimit(agentAddress: string): Promise<boolean> {
    try {
      const result = await this.rateLimitService.checkLimit(agentAddress);
      return result.allowed;
    } catch (error) {
      this.logger.error(`Failed to check rate limit for agent ${agentAddress}:`, error);
      return false;
    }
  }

  /**
   * Increment agent intent count (called when creating new intent)
   */
  async incrementAgentIntentCount(agentAddress: string): Promise<void> {
    try {
      await this.rateLimitService.incrementCount(agentAddress);
      this.logger.log(`Intent count incremented for agent ${agentAddress}`);
    } catch (error) {
      this.logger.error(`Failed to increment intent count for agent ${agentAddress}:`, error);
      throw error;
    }
  }

  /**
   * Decrement agent intent count (called when completing/cancelling intent)
   */
  async decrementAgentIntentCount(agentAddress: string): Promise<void> {
    try {
      await this.rateLimitService.decrementCount(agentAddress);
      this.logger.log(`Intent count decremented for agent ${agentAddress}`);
    } catch (error) {
      this.logger.error(`Failed to decrement intent count for agent ${agentAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get current active intent count for agent
   */
  async getCurrentAgentIntentCount(agentAddress: string): Promise<number> {
    try {
      return await this.rateLimitService.getCurrentCount(agentAddress);
    } catch (error) {
      this.logger.error(`Failed to get current intent count for agent ${agentAddress}:`, error);
      return 0;
    }
  }

  /**
   * Validate rate limit before intent creation
   */
  async validateRateLimit(agentAddress: string): Promise<void> {
    try {
      await this.rateLimitService.validateBeforeIntentCreation(agentAddress);
    } catch (error) {
      this.logger.error(`Rate limit validation failed for agent ${agentAddress}:`, error);
      throw error;
    }
  }

  // ==================== EMERGENCY PAUSE ====================

  /**
   * Check if system is in emergency pause state
   */
  async isEmergencyPaused(): Promise<boolean> {
    try {
      const [intentVaultPaused, agentRegistryPaused, executionManagerPaused] = await Promise.all([
        this.contractService.isPaused('intentVault'),
        this.contractService.isPaused('agentRegistry'),
        this.contractService.isPaused('executionManager')
      ]);

      return intentVaultPaused || agentRegistryPaused || executionManagerPaused;
    } catch (error) {
      this.logger.error('Failed to check emergency pause state:', error);
      return false;
    }
  }

  /**
   * Handle emergency pause activation
   */
  async handleEmergencyPause(): Promise<void> {
    this.logger.warn('Emergency pause activated - blocking new operations');
    // Implementation would queue operations and notify relevant services
  }

  /**
   * Handle emergency pause deactivation
   */
  async handleEmergencyUnpause(): Promise<void> {
    this.logger.log('Emergency pause deactivated - resuming normal operations');
    // Implementation would process queued operations
  }

  // ==================== REPUTATION VALIDATION ====================

  /**
   * Validate agent reputation meets minimum threshold
   */
  async validateAgentReputation(agentAddress: string, minThreshold: number): Promise<boolean> {
    try {
      const reputation = await this.contractService.getAgentReputationScore(agentAddress);
      return reputation >= minThreshold;
    } catch (error) {
      this.logger.error(`Failed to validate reputation for agent ${agentAddress}:`, error);
      return false;
    }
  }

  // ==================== PROTOCOL VALIDATION ====================

  /**
   * Validate protocols against whitelist
   */
  async validateProtocolWhitelist(protocols: string[]): Promise<boolean> {
    try {
      const result = await this.protocolWhitelist.validateProtocols(protocols);
      return result.allValid;
    } catch (error) {
      this.logger.error('Failed to validate protocol whitelist:', error);
      return false;
    }
  }

  // ==================== XCM VALIDATION ====================

  /**
   * Validate XCM message structure and authenticity
   */
  async validateXCMMessage(message: any): Promise<SecurityValidationResult> {
    try {
      const result = await this.xcmValidation.validateXCMMessage(message);
      return {
        isValid: result.isValid,
        errors: result.errors.map(err => typeof err === 'string' ? err : (err as any).message || 'Unknown error'),
        warnings: result.warnings.map(warn => typeof warn === 'string' ? warn : (warn as any).message || 'Unknown warning')
      };
    } catch (error) {
      this.logger.error('Failed to validate XCM message:', error);
      return {
        isValid: false,
        errors: [`XCM validation error: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  // ==================== SLIPPAGE PROTECTION ====================

  /**
   * Validate slippage protection parameters
   */
  async validateSlippageProtection(params: any): Promise<SecurityValidationResult> {
    try {
      const result = await this.slippageProtection.validateSlippageParameters(params);
      return {
        isValid: result.isValid,
        errors: result.errors.map(err => typeof err === 'string' ? err : (err as any).message || 'Slippage error'),
        warnings: result.warnings.map(warn => typeof warn === 'string' ? warn : (warn as any).message || 'Slippage warning')
      };
    } catch (error) {
      this.logger.error('Failed to validate slippage protection:', error);
      return {
        isValid: false,
        errors: [`Slippage validation error: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  /**
   * Enforce slippage limits for trade execution
   */
  async enforceSlippageLimit(params: any): Promise<boolean> {
    try {
      return await this.slippageProtection.enforceSlippageLimit(params);
    } catch (error) {
      this.logger.error('Failed to enforce slippage limit:', error);
      return false;
    }
  }

  // ==================== DEADLINE MANAGEMENT ====================

  /**
   * Apply safety margin to execution deadline
   */
  async applySafetyMarginToDeadline(originalDeadline: number): Promise<number> {
    try {
      const result = await this.deadlineManagement.applySafetyMargin(originalDeadline);
      return result.adjustedDeadline;
    } catch (error) {
      this.logger.error('Failed to apply safety margin to deadline:', error);
      return originalDeadline;
    }
  }

  /**
   * Validate execution deadline is realistic
   */
  async validateExecutionDeadline(deadline: number, estimatedExecutionTime?: number): Promise<boolean> {
    try {
      const result = await this.deadlineManagement.validateExecutionDeadline(deadline, estimatedExecutionTime);
      return result.isValid;
    } catch (error) {
      this.logger.error('Failed to validate execution deadline:', error);
      return false;
    }
  }

  /**
   * Handle deadline timeout scenarios
   */
  async handleDeadlineTimeout(intentId: bigint): Promise<void> {
    try {
      await this.deadlineManagement.handleDeadlineTimeout(intentId);
      this.logger.warn(`Handled deadline timeout for intent ${intentId}`);
    } catch (error) {
      this.logger.error(`Failed to handle deadline timeout for intent ${intentId}:`, error);
      throw error;
    }
  }

  // ==================== ERROR HANDLING AND RETRY LOGIC ====================

  /**
   * Create standardized security error response
   */
  createSecurityError(errorCode: string, details: Record<string, any> = {}): SecurityErrorResponse {
    const errorTemplate = this.SECURITY_ERRORS[errorCode as keyof typeof this.SECURITY_ERRORS];
    
    if (!errorTemplate) {
      return {
        code: 'UNKNOWN_SECURITY_ERROR',
        message: 'Unknown security error occurred',
        details,
        retryable: false,
        category: SecurityErrorCategory.CONFIGURATION
      };
    }

    return {
      ...errorTemplate,
      details
    };
  }

  /**
   * Handle contract reversion errors
   */
  async handleContractReversion(error: any, operation: string): Promise<SecurityErrorResponse> {
    this.logger.error(`Contract reversion in ${operation}:`, error);
    
    // Log for monitoring
    await this.securityMonitoring.recordSecurityEvent({
      type: 'CONTRACT_REVERSION',
      category: 'CONTRACT_REVERSION',
      code: 'CONTRACT_REVERTED',
      message: error.message,
      details: { operation, originalError: error.message },
      context: { operation },
      timestamp: new Date()
    });

    return this.createSecurityError('CONTRACT_REVERTED', {
      operation,
      originalError: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Implement retry logic with exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.RETRY_CONFIG, ...customConfig };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        const isRetryable = config.retryableErrors.some(retryableError => 
          lastError.message.includes(retryableError)
        );

        if (!isRetryable || attempt === config.maxAttempts) {
          this.logger.error(`Operation ${operationName} failed after ${attempt} attempts:`, lastError);
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        this.logger.warn(`Operation ${operationName} failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms:`, lastError.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Log security errors for monitoring and debugging
   */
  async logSecurityError(error: SecurityErrorResponse, context: Record<string, any> = {}): Promise<void> {
    try {
      const logEntry = {
        ...error,
        context,
        timestamp: new Date().toISOString()
      };

      this.logger.error(`Security Error [${error.category}]: ${error.message}`, logEntry);
      
      // Record in monitoring system
      await this.securityMonitoring.recordSecurityEvent({
        type: 'SECURITY_ERROR',
        category: error.category,
        code: error.code,
        message: error.message,
        details: error.details,
        context,
        timestamp: new Date()
      });
    } catch (monitoringError) {
      this.logger.error('Failed to log security error:', monitoringError);
    }
  }

  // ==================== COMPREHENSIVE SECURITY VALIDATION ====================

  /**
   * Perform comprehensive security validation for an operation
   */
  async validateSecurityConstraints(params: SecurityOperationParams): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Check emergency pause
      if (await this.isEmergencyPaused()) {
        const error = this.createSecurityError('EMERGENCY_PAUSE_ACTIVE');
        result.isValid = false;
        result.errors.push(error.message);
        await this.logSecurityError(error, { operation: 'validateSecurityConstraints' });
      }

      // Check agent rate limits
      if (params.agentAddress) {
        const withinRateLimit = await this.checkAgentRateLimit(params.agentAddress);
        if (!withinRateLimit) {
          const error = this.createSecurityError('RATE_LIMIT_EXCEEDED', { agentAddress: params.agentAddress });
          result.isValid = false;
          result.errors.push(error.message);
          await this.logSecurityError(error, { agentAddress: params.agentAddress });
        }
      }

      // Check agent reputation
      if (params.agentAddress && params.minReputation) {
        const hasMinReputation = await this.validateAgentReputation(
          params.agentAddress,
          params.minReputation
        );
        if (!hasMinReputation) {
          const error = this.createSecurityError('INSUFFICIENT_REPUTATION', { 
            agentAddress: params.agentAddress,
            requiredReputation: params.minReputation
          });
          result.isValid = false;
          result.errors.push(error.message);
          await this.logSecurityError(error, { agentAddress: params.agentAddress });
        }
      }

      // Check protocol whitelist
      if (params.protocols && params.protocols.length > 0) {
        const protocolsValid = await this.validateProtocolWhitelist(params.protocols);
        if (!protocolsValid) {
          const error = this.createSecurityError('PROTOCOL_NOT_WHITELISTED', { protocols: params.protocols });
          result.isValid = false;
          result.errors.push(error.message);
          await this.logSecurityError(error, { protocols: params.protocols });
        }
      }

      // Check timelock constraints
      if (params.requiresTimelock && params.timelockOperationId) {
        const timelockEnforcement = await this.validateTimelockExecution(params.timelockOperationId);
        if (!timelockEnforcement.canExecute) {
          const error = this.createSecurityError('TIMELOCK_NOT_READY', { 
            operationId: params.timelockOperationId,
            timeRemaining: timelockEnforcement.timeRemaining
          });
          result.isValid = false;
          result.errors.push(`${error.message}: ${timelockEnforcement.reason}`);
          await this.logSecurityError(error, { operationId: params.timelockOperationId });
        }
      }

      // Check slippage protection
      if (params.slippageParams) {
        const slippageResult = await this.validateSlippageProtection(params.slippageParams);
        if (!slippageResult.isValid) {
          const error = this.createSecurityError('SLIPPAGE_EXCEEDED', { slippageParams: params.slippageParams });
          result.isValid = false;
          result.errors.push(...slippageResult.errors.map(err => typeof err === 'string' ? err : (err as any).message || 'Slippage error'));
          await this.logSecurityError(error, { slippageParams: params.slippageParams });
        }
        result.warnings.push(...slippageResult.warnings.map(warn => typeof warn === 'string' ? warn : (warn as any).message || 'Slippage warning'));
      }

      // Check execution deadline
      if (params.deadline) {
        const deadlineValid = await this.validateExecutionDeadline(params.deadline);
        if (!deadlineValid) {
          const error = this.createSecurityError('DEADLINE_EXCEEDED', { deadline: params.deadline });
          result.isValid = false;
          result.errors.push(error.message);
          await this.logSecurityError(error, { deadline: params.deadline });
        }
      }

      // Check XCM message validation
      if (params.xcmMessage) {
        const xcmResult = await this.validateXCMMessage(params.xcmMessage);
        if (!xcmResult.isValid) {
          const error = this.createSecurityError('XCM_VALIDATION_FAILED', { xcmMessage: params.xcmMessage });
          result.isValid = false;
          result.errors.push(...xcmResult.errors.map(err => typeof err === 'string' ? err : (err as any).message || 'XCM error'));
          await this.logSecurityError(error, { xcmMessage: params.xcmMessage });
        }
        result.warnings.push(...xcmResult.warnings.map(warn => typeof warn === 'string' ? warn : (warn as any).message || 'XCM warning'));
      }

    } catch (error) {
      this.logger.error('Security validation failed:', error);
      const securityError = this.createSecurityError('CONTRACT_REVERTED', { 
        originalError: (error as Error).message 
      });
      result.isValid = false;
      result.errors.push(`Security validation error: ${(error as Error).message}`);
      await this.logSecurityError(securityError, { validationParams: params });
    }

    return result;
  }

  /**
   * Validate security constraints with retry logic
   */
  async validateSecurityConstraintsWithRetry(params: SecurityOperationParams): Promise<SecurityValidationResult> {
    return await this.executeWithRetry(
      () => this.validateSecurityConstraints(params),
      'validateSecurityConstraints'
    );
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get comprehensive security status summary
   */
  async getSecurityStatus(): Promise<{
    emergencyPaused: boolean;
    pendingTimelockOperations: number;
    readyTimelockOperations: number;
    securityConfig: any;
    systemHealth: {
      rateLimitingActive: boolean;
      reputationSystemActive: boolean;
      protocolWhitelistActive: boolean;
      xcmValidationActive: boolean;
      slippageProtectionActive: boolean;
      deadlineManagementActive: boolean;
    };
  }> {
    try {
      const [emergencyPaused, pendingOps, readyOps, config] = await Promise.all([
        this.isEmergencyPaused(),
        this.timelockManager.listPendingOperations(),
        this.timelockManager.listReadyOperations(),
        this.securityConfig.getConfiguration()
      ]);

      // Check system health
      const systemHealth = {
        rateLimitingActive: true, // Always active
        reputationSystemActive: true, // Always active
        protocolWhitelistActive: await this.securityConfig.isProtocolWhitelistEnabled(),
        xcmValidationActive: true, // Always active
        slippageProtectionActive: true, // Always active
        deadlineManagementActive: true // Always active
      };

      return {
        emergencyPaused,
        pendingTimelockOperations: pendingOps.length,
        readyTimelockOperations: readyOps.length,
        securityConfig: config,
        systemHealth
      };
    } catch (error) {
      this.logger.error('Failed to get security status:', error);
      throw error;
    }
  }

  /**
   * Get security metrics for monitoring
   */
  async getSecurityMetrics(): Promise<{
    totalSecurityEvents: number;
    errorsByCategory: Record<SecurityErrorCategory, number>;
    rateLimitViolations: number;
    timelockOperationsToday: number;
    emergencyPauseActivations: number;
  }> {
    try {
      return await this.securityMonitoring.getSecurityMetrics();
    } catch (error) {
      this.logger.error('Failed to get security metrics:', error);
      throw error;
    }
  }

  /**
   * Reload security configuration without restart
   */
  async reloadSecurityConfiguration(): Promise<void> {
    try {
      await this.securityConfig.reloadConfiguration();
      this.logger.log('Security configuration reloaded successfully');
    } catch (error) {
      this.logger.error('Failed to reload security configuration:', error);
      throw error;
    }
  }

  /**
   * Validate security configuration values
   */
  async validateSecurityConfiguration(config: any): Promise<SecurityValidationResult> {
    try {
      // Use the public method to validate configuration
      await this.securityConfig.updateConfiguration(config);
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      this.logger.error('Failed to validate security configuration:', error);
      return {
        isValid: false,
        errors: [`Configuration validation error: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  /**
   * Get default security configuration for new deployments
   */
  async getDefaultSecurityConfiguration(): Promise<any> {
    try {
      // Return the current configuration as default
      return await this.securityConfig.getConfiguration();
    } catch (error) {
      this.logger.error('Failed to get default security configuration:', error);
      throw error;
    }
  }
}