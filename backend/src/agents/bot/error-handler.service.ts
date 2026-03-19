import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonitoringService } from './monitoring.service';
import { SecurityMonitoringService } from '../../shared/services/security-monitoring.service';

export interface ErrorContext {
  intentId?: number;
  agentAddress?: string;
  operation?: string;
  step?: number;
  protocol?: string;
  chain?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'rollback' | 'skip' | 'abort' | 'escalate';
  maxAttempts?: number;
  delayMs?: number;
  condition?: (error: Error, context: ErrorContext) => boolean;
  description: string;
}

export interface ErrorHandlingResult {
  handled: boolean;
  action: ErrorRecoveryAction['type'];
  shouldRetry: boolean;
  retryDelayMs?: number;
  escalated: boolean;
  message: string;
}

@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);
  private readonly retryAttempts = new Map<string, number>();
  private readonly errorPatterns = new Map<string, ErrorRecoveryAction>();

  constructor(
    private configService: ConfigService,
    private monitoringService: MonitoringService,
    private securityMonitoring: SecurityMonitoringService,
  ) {
    this.initializeErrorPatterns();
  }

  private initializeErrorPatterns(): void {
    // Network and RPC errors
    this.errorPatterns.set('NETWORK_ERROR', {
      type: 'retry',
      maxAttempts: 3,
      delayMs: 5000,
      description: 'Network connectivity issue - retry with exponential backoff',
    });

    this.errorPatterns.set('RPC_ERROR', {
      type: 'retry',
      maxAttempts: 2,
      delayMs: 3000,
      description: 'RPC endpoint issue - retry with different endpoint if available',
    });

    // Gas and transaction errors
    this.errorPatterns.set('GAS_LIMIT_EXCEEDED', {
      type: 'retry',
      maxAttempts: 2,
      delayMs: 1000,
      condition: (error, context) => {
        // Only retry if we can increase gas limit
        return context.gasUsed ? BigInt(context.gasUsed) < BigInt('1000000') : true;
      },
      description: 'Gas limit exceeded - retry with higher gas limit',
    });

    this.errorPatterns.set('GAS_PRICE_TOO_LOW', {
      type: 'retry',
      maxAttempts: 2,
      delayMs: 2000,
      description: 'Gas price too low - retry with higher gas price',
    });

    this.errorPatterns.set('NONCE_TOO_LOW', {
      type: 'retry',
      maxAttempts: 1,
      delayMs: 1000,
      description: 'Nonce too low - retry with updated nonce',
    });

    // Contract and protocol errors
    this.errorPatterns.set('SLIPPAGE_EXCEEDED', {
      type: 'retry',
      maxAttempts: 2,
      delayMs: 5000,
      description: 'Slippage exceeded - retry with higher slippage tolerance',
    });

    this.errorPatterns.set('INSUFFICIENT_LIQUIDITY', {
      type: 'skip',
      description: 'Insufficient liquidity - skip this step and try alternative',
    });

    this.errorPatterns.set('DEADLINE_EXCEEDED', {
      type: 'abort',
      description: 'Transaction deadline exceeded - abort execution',
    });

    // Security and validation errors
    this.errorPatterns.set('UNAUTHORIZED', {
      type: 'abort',
      description: 'Unauthorized operation - abort and escalate',
    });

    this.errorPatterns.set('INVALID_SIGNATURE', {
      type: 'abort',
      description: 'Invalid signature - abort execution',
    });

    // XCM and cross-chain errors
    this.errorPatterns.set('XCM_FAILED', {
      type: 'retry',
      maxAttempts: 1,
      delayMs: 30000, // Wait longer for XCM
      description: 'XCM message failed - retry once after delay',
    });

    this.errorPatterns.set('BRIDGE_TIMEOUT', {
      type: 'escalate',
      description: 'Bridge operation timed out - escalate for manual intervention',
    });

    // Protocol-specific errors
    this.errorPatterns.set('HYDRATION_POOL_NOT_FOUND', {
      type: 'skip',
      description: 'Hydration pool not found - skip and try alternative protocol',
    });

    this.errorPatterns.set('BIFROST_STAKING_PAUSED', {
      type: 'skip',
      description: 'Bifrost staking paused - skip liquid staking step',
    });

    // Critical system errors
    this.errorPatterns.set('SYSTEM_ERROR', {
      type: 'abort',
      description: 'Critical system error - abort execution and alert',
    });
  }

  async handleError(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    try {
      this.logger.error(`Handling error: ${error.message}`, {
        error: error.stack,
        context,
      });

      // Classify the error
      const errorType = this.classifyError(error);
      const pattern = this.errorPatterns.get(errorType);

      if (!pattern) {
        return this.handleUnknownError(error, context);
      }

      // Check retry attempts
      const retryKey = this.getRetryKey(context);
      const currentAttempts = this.retryAttempts.get(retryKey) || 0;

      // Record error in monitoring
      await this.recordError(error, context, errorType);

      // Determine action based on pattern and attempts
      const result = await this.determineAction(error, context, pattern, currentAttempts);

      // Update retry counter if retrying
      if (result.shouldRetry) {
        this.retryAttempts.set(retryKey, currentAttempts + 1);
      } else {
        this.retryAttempts.delete(retryKey);
      }

      // Log the handling result
      this.logger.log(`Error handling result: ${result.action} - ${result.message}`, {
        errorType,
        attempts: currentAttempts,
        context,
      });

      return result;

    } catch (handlingError) {
      this.logger.error('Error in error handler:', handlingError);
      return {
        handled: false,
        action: 'abort',
        shouldRetry: false,
        escalated: true,
        message: 'Error handler failed - aborting execution',
      };
    }
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
      return 'NETWORK_ERROR';
    }

    if (message.includes('rpc') || message.includes('json-rpc')) {
      return 'RPC_ERROR';
    }

    // Gas errors
    if (message.includes('gas limit') || message.includes('out of gas')) {
      return 'GAS_LIMIT_EXCEEDED';
    }

    if (message.includes('gas price') || message.includes('underpriced')) {
      return 'GAS_PRICE_TOO_LOW';
    }

    if (message.includes('nonce too low')) {
      return 'NONCE_TOO_LOW';
    }

    // Contract errors
    if (message.includes('slippage') || message.includes('price impact')) {
      return 'SLIPPAGE_EXCEEDED';
    }

    if (message.includes('insufficient liquidity') || message.includes('insufficient reserves')) {
      return 'INSUFFICIENT_LIQUIDITY';
    }

    if (message.includes('deadline') || message.includes('expired')) {
      return 'DEADLINE_EXCEEDED';
    }

    // Security errors
    if (message.includes('unauthorized') || message.includes('access denied')) {
      return 'UNAUTHORIZED';
    }

    if (message.includes('signature') || message.includes('invalid signer')) {
      return 'INVALID_SIGNATURE';
    }

    // XCM errors
    if (message.includes('xcm') || message.includes('cross-chain')) {
      return 'XCM_FAILED';
    }

    if (message.includes('bridge') && message.includes('timeout')) {
      return 'BRIDGE_TIMEOUT';
    }

    // Protocol-specific errors
    if (message.includes('hydration') && message.includes('pool')) {
      return 'HYDRATION_POOL_NOT_FOUND';
    }

    if (message.includes('bifrost') && message.includes('paused')) {
      return 'BIFROST_STAKING_PAUSED';
    }

    // Default to system error
    return 'SYSTEM_ERROR';
  }

  private async determineAction(
    error: Error,
    context: ErrorContext,
    pattern: ErrorRecoveryAction,
    currentAttempts: number
  ): Promise<ErrorHandlingResult> {
    // Check if we've exceeded max attempts
    if (pattern.maxAttempts && currentAttempts >= pattern.maxAttempts) {
      return {
        handled: true,
        action: 'abort',
        shouldRetry: false,
        escalated: true,
        message: `Max retry attempts (${pattern.maxAttempts}) exceeded - aborting`,
      };
    }

    // Check condition if provided
    if (pattern.condition && !pattern.condition(error, context)) {
      return {
        handled: true,
        action: 'abort',
        shouldRetry: false,
        escalated: false,
        message: 'Error condition not met for recovery - aborting',
      };
    }

    // Determine action based on pattern type
    switch (pattern.type) {
      case 'retry':
        const delayMs = this.calculateRetryDelay(pattern.delayMs || 1000, currentAttempts);
        return {
          handled: true,
          action: 'retry',
          shouldRetry: true,
          retryDelayMs: delayMs,
          escalated: false,
          message: `${pattern.description} (attempt ${currentAttempts + 1})`,
        };

      case 'rollback':
        return {
          handled: true,
          action: 'rollback',
          shouldRetry: false,
          escalated: false,
          message: pattern.description,
        };

      case 'skip':
        return {
          handled: true,
          action: 'skip',
          shouldRetry: false,
          escalated: false,
          message: pattern.description,
        };

      case 'escalate':
        await this.escalateError(error, context);
        return {
          handled: true,
          action: 'escalate',
          shouldRetry: false,
          escalated: true,
          message: pattern.description,
        };

      case 'abort':
      default:
        return {
          handled: true,
          action: 'abort',
          shouldRetry: false,
          escalated: false,
          message: pattern.description,
        };
    }
  }

  private async handleUnknownError(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    this.logger.warn(`Unknown error type: ${error.message}`, { context });

    // Record as unknown error for analysis
    await this.recordError(error, context, 'UNKNOWN');

    // Default to abort for unknown errors
    return {
      handled: false,
      action: 'abort',
      shouldRetry: false,
      escalated: true,
      message: `Unknown error type - aborting for safety: ${error.message}`,
    };
  }

  private calculateRetryDelay(baseDelayMs: number, attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    return Math.min(exponentialDelay + jitter, 60000); // Cap at 1 minute
  }

  private getRetryKey(context: ErrorContext): string {
    return `${context.intentId || 'unknown'}_${context.operation || 'unknown'}_${context.step || 0}`;
  }

  private async recordError(
    error: Error,
    context: ErrorContext,
    errorType: string
  ): Promise<void> {
    try {
      // Record in monitoring service
      if (context.intentId) {
        await this.monitoringService.recordExecutionError(
          context.intentId,
          `${errorType}: ${error.message}`
        );
      }

      // Record in security monitoring
      await this.securityMonitoring.recordSecurityEvent({
        type: 'EXECUTION_ERROR',
        category: 'BOT_OPERATION',
        code: errorType,
        message: error.message,
        details: {
          errorType,
          context,
          stack: error.stack,
        },
        timestamp: new Date(),
      });

    } catch (recordingError) {
      this.logger.error('Failed to record error:', recordingError);
    }
  }

  private async escalateError(error: Error, context: ErrorContext): Promise<void> {
    try {
      this.logger.error(`ESCALATED ERROR: ${error.message}`, {
        error: error.stack,
        context,
      });

      // Create high-priority alert
      await this.securityMonitoring.recordSecurityEvent({
        type: 'ESCALATED_ERROR',
        category: 'CRITICAL',
        message: `Bot execution error requires manual intervention: ${error.message}`,
        details: {
          error: error.message,
          stack: error.stack,
          context,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });

      // In production, this would also:
      // - Send notifications to operators
      // - Create support tickets
      // - Trigger emergency procedures if needed

    } catch (escalationError) {
      this.logger.error('Failed to escalate error:', escalationError);
    }
  }

  // Recovery action implementations
  async executeRollback(context: ErrorContext): Promise<boolean> {
    try {
      this.logger.log(`Executing rollback for intent ${context.intentId}`);

      // This would implement actual rollback logic
      // For now, just log the attempt
      return true;

    } catch (error) {
      this.logger.error('Rollback failed:', error);
      return false;
    }
  }

  async skipStep(context: ErrorContext): Promise<boolean> {
    try {
      this.logger.log(`Skipping step ${context.step} for intent ${context.intentId}`);

      // Mark step as skipped in execution log
      return true;

    } catch (error) {
      this.logger.error('Skip step failed:', error);
      return false;
    }
  }

  // Utility methods
  clearRetryAttempts(context: ErrorContext): void {
    const retryKey = this.getRetryKey(context);
    this.retryAttempts.delete(retryKey);
  }

  getRetryAttempts(context: ErrorContext): number {
    const retryKey = this.getRetryKey(context);
    return this.retryAttempts.get(retryKey) || 0;
  }

  // Error analysis and reporting
  async getErrorStatistics(): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    retrySuccessRate: number;
    escalationRate: number;
  }> {
    // This would query the monitoring database for error statistics
    // For now, return placeholder data
    return {
      totalErrors: 0,
      errorsByType: {},
      retrySuccessRate: 0,
      escalationRate: 0,
    };
  }

  async getRecentErrors(limit: number = 50): Promise<Array<{
    timestamp: Date;
    errorType: string;
    message: string;
    context: ErrorContext;
    handled: boolean;
    action: string;
  }>> {
    // This would query recent errors from the database
    // For now, return empty array
    return [];
  }
}