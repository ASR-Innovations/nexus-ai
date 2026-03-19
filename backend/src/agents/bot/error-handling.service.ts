/**
 * Error Handling Service
 * Comprehensive error categorization, recovery strategies, and circuit breaker patterns
 * Handles protocol errors, network failures, and system issues with intelligent retry logic
 */

import { Injectable, Logger } from '@nestjs/common';

export enum ErrorCategory {
  PROTOCOL_ERROR = 'protocol_error',
  NETWORK_ERROR = 'network_error',
  SECURITY_ERROR = 'security_error',
  VALIDATION_ERROR = 'validation_error',
  SYSTEM_ERROR = 'system_error',
  TIMEOUT_ERROR = 'timeout_error',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  SLIPPAGE_ERROR = 'slippage_error',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RecoverabilityStatus {
  RECOVERABLE = 'recoverable',
  RETRYABLE = 'retryable',
  PERMANENT = 'permanent',
}

export interface CategorizedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverability: RecoverabilityStatus;
  originalError: Error;
  message: string;
  code?: string;
  context?: any;
  suggestedAction: string;
  retryable: boolean;
  retryDelay?: number;
}

export interface RecoveryAction {
  type: 'retry' | 'rollback' | 'skip' | 'abort' | 'notify';
  delay?: number;
  maxAttempts?: number;
  fallbackAction?: RecoveryAction;
  metadata?: any;
}

export interface CircuitBreakerState {
  service: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount: number;
  totalRequests: number;
}

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);

  // Circuit breaker states per service
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  // Circuit breaker configuration
  private readonly FAILURE_THRESHOLD = 5;
  private readonly SUCCESS_THRESHOLD = 2;
  private readonly TIMEOUT_MS = 60000; // 1 minute
  private readonly HALF_OPEN_REQUESTS = 3;

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_DELAY_MS = 30000;

  // Error tracking for analytics
  private errorHistory: Array<{
    timestamp: Date;
    category: ErrorCategory;
    severity: ErrorSeverity;
    service: string;
    recovered: boolean;
  }> = [];

  // ============================================================================
  // Error Classification
  // ============================================================================

  classifyError(error: Error, context?: any): CategorizedError {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';

    // Protocol-specific errors
    if (this.isProtocolError(errorMessage, errorStack)) {
      return this.categorizeProtocolError(error, context);
    }

    // Network errors
    if (this.isNetworkError(errorMessage, errorStack)) {
      return this.categorizeNetworkError(error, context);
    }

    // Security errors
    if (this.isSecurityError(errorMessage, errorStack)) {
      return this.categorizeSecurityError(error, context);
    }

    // Validation errors
    if (this.isValidationError(errorMessage, errorStack)) {
      return this.categorizeValidationError(error, context);
    }

    // Timeout errors
    if (this.isTimeoutError(errorMessage, errorStack)) {
      return this.categorizeTimeoutError(error, context);
    }

    // Insufficient funds
    if (this.isInsufficientFundsError(errorMessage, errorStack)) {
      return this.categorizeInsufficientFundsError(error, context);
    }

    // Slippage errors
    if (this.isSlippageError(errorMessage, errorStack)) {
      return this.categorizeSlippageError(error, context);
    }

    // Default: system error
    return this.categorizeSystemError(error, context);
  }

  // ============================================================================
  // Error Type Detection
  // ============================================================================

  private isProtocolError(message: string, stack: string): boolean {
    const protocolKeywords = [
      'revert',
      'execution reverted',
      'contract',
      'insufficient liquidity',
      'pool',
      'swap failed',
      'deadline',
      'expired',
    ];
    return protocolKeywords.some(keyword => message.includes(keyword) || stack.includes(keyword));
  }

  private isNetworkError(message: string, stack: string): boolean {
    const networkKeywords = [
      'network',
      'connection',
      'econnrefused',
      'etimedout',
      'rpc',
      'websocket',
      'disconnected',
      'unreachable',
      'dns',
    ];
    return networkKeywords.some(keyword => message.includes(keyword) || stack.includes(keyword));
  }

  private isSecurityError(message: string, stack: string): boolean {
    const securityKeywords = [
      'unauthorized',
      'forbidden',
      'access denied',
      'permission',
      'signature',
      'authentication',
      'limit exceeded',
    ];
    return securityKeywords.some(keyword => message.includes(keyword) || stack.includes(keyword));
  }

  private isValidationError(message: string, stack: string): boolean {
    const validationKeywords = [
      'invalid',
      'validation',
      'required',
      'missing',
      'malformed',
      'format',
    ];
    return validationKeywords.some(keyword => message.includes(keyword) || stack.includes(keyword));
  }

  private isTimeoutError(message: string, stack: string): boolean {
    const timeoutKeywords = ['timeout', 'timed out', 'deadline exceeded'];
    return timeoutKeywords.some(keyword => message.includes(keyword) || stack.includes(keyword));
  }

  private isInsufficientFundsError(message: string, stack: string): boolean {
    const fundsKeywords = [
      'insufficient',
      'balance',
      'funds',
      'not enough',
      'underfunded',
    ];
    return fundsKeywords.some(keyword => message.includes(keyword) || stack.includes(keyword));
  }

  private isSlippageError(message: string, stack: string): boolean {
    const slippageKeywords = ['slippage', 'price impact', 'min amount', 'max amount'];
    return slippageKeywords.some(keyword => message.includes(keyword) || stack.includes(keyword));
  }

  // ============================================================================
  // Error Categorization
  // ============================================================================

  private categorizeProtocolError(error: Error, context?: any): CategorizedError {
    return {
      category: ErrorCategory.PROTOCOL_ERROR,
      severity: ErrorSeverity.MEDIUM,
      recoverability: RecoverabilityStatus.RETRYABLE,
      originalError: error,
      message: error.message,
      context,
      suggestedAction: 'Retry with adjusted parameters or different protocol',
      retryable: true,
      retryDelay: 5000,
    };
  }

  private categorizeNetworkError(error: Error, context?: any): CategorizedError {
    return {
      category: ErrorCategory.NETWORK_ERROR,
      severity: ErrorSeverity.HIGH,
      recoverability: RecoverabilityStatus.RETRYABLE,
      originalError: error,
      message: error.message,
      context,
      suggestedAction: 'Retry with exponential backoff',
      retryable: true,
      retryDelay: 2000,
    };
  }

  private categorizeSecurityError(error: Error, context?: any): CategorizedError {
    return {
      category: ErrorCategory.SECURITY_ERROR,
      severity: ErrorSeverity.CRITICAL,
      recoverability: RecoverabilityStatus.PERMANENT,
      originalError: error,
      message: error.message,
      context,
      suggestedAction: 'Abort operation and notify security team',
      retryable: false,
    };
  }

  private categorizeValidationError(error: Error, context?: any): CategorizedError {
    return {
      category: ErrorCategory.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      recoverability: RecoverabilityStatus.PERMANENT,
      originalError: error,
      message: error.message,
      context,
      suggestedAction: 'Fix input parameters and retry',
      retryable: false,
    };
  }

  private categorizeTimeoutError(error: Error, context?: any): CategorizedError {
    return {
      category: ErrorCategory.TIMEOUT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      recoverability: RecoverabilityStatus.RETRYABLE,
      originalError: error,
      message: error.message,
      context,
      suggestedAction: 'Retry with increased timeout',
      retryable: true,
      retryDelay: 3000,
    };
  }

  private categorizeInsufficientFundsError(error: Error, context?: any): CategorizedError {
    return {
      category: ErrorCategory.INSUFFICIENT_FUNDS,
      severity: ErrorSeverity.HIGH,
      recoverability: RecoverabilityStatus.PERMANENT,
      originalError: error,
      message: error.message,
      context,
      suggestedAction: 'Notify user to add funds',
      retryable: false,
    };
  }

  private categorizeSlippageError(error: Error, context?: any): CategorizedError {
    return {
      category: ErrorCategory.SLIPPAGE_ERROR,
      severity: ErrorSeverity.MEDIUM,
      recoverability: RecoverabilityStatus.RETRYABLE,
      originalError: error,
      message: error.message,
      context,
      suggestedAction: 'Retry with increased slippage tolerance',
      retryable: true,
      retryDelay: 2000,
    };
  }

  private categorizeSystemError(error: Error, context?: any): CategorizedError {
    return {
      category: ErrorCategory.SYSTEM_ERROR,
      severity: ErrorSeverity.HIGH,
      recoverability: RecoverabilityStatus.RECOVERABLE,
      originalError: error,
      message: error.message,
      context,
      suggestedAction: 'Log error and attempt recovery',
      retryable: true,
      retryDelay: 5000,
    };
  }

  // ============================================================================
  // Recovery Strategy
  // ============================================================================

  determineRecoveryAction(
    categorizedError: CategorizedError,
    attemptCount: number
  ): RecoveryAction {
    // Check if max retries exceeded
    if (attemptCount >= this.MAX_RETRIES) {
      return {
        type: 'abort',
        metadata: { reason: 'max_retries_exceeded', attempts: attemptCount },
      };
    }

    // Handle based on category
    switch (categorizedError.category) {
      case ErrorCategory.PROTOCOL_ERROR:
        return this.handleProtocolError(categorizedError, attemptCount);

      case ErrorCategory.NETWORK_ERROR:
        return this.handleNetworkError(categorizedError, attemptCount);

      case ErrorCategory.SECURITY_ERROR:
        return {
          type: 'abort',
          metadata: { reason: 'security_violation' },
        };

      case ErrorCategory.VALIDATION_ERROR:
        return {
          type: 'abort',
          metadata: { reason: 'invalid_input' },
        };

      case ErrorCategory.TIMEOUT_ERROR:
        return this.handleTimeoutError(categorizedError, attemptCount);

      case ErrorCategory.INSUFFICIENT_FUNDS:
        return {
          type: 'notify',
          metadata: { reason: 'insufficient_funds', action: 'request_funds' },
        };

      case ErrorCategory.SLIPPAGE_ERROR:
        return this.handleSlippageError(categorizedError, attemptCount);

      default:
        return this.handleSystemError(categorizedError, attemptCount);
    }
  }

  private handleProtocolError(error: CategorizedError, attemptCount: number): RecoveryAction {
    return {
      type: 'retry',
      delay: this.calculateExponentialBackoff(attemptCount),
      maxAttempts: this.MAX_RETRIES,
      fallbackAction: {
        type: 'rollback',
        metadata: { reason: 'protocol_failure' },
      },
    };
  }

  private handleNetworkError(error: CategorizedError, attemptCount: number): RecoveryAction {
    return {
      type: 'retry',
      delay: this.calculateExponentialBackoff(attemptCount),
      maxAttempts: this.MAX_RETRIES,
      metadata: { strategy: 'exponential_backoff' },
    };
  }

  private handleTimeoutError(error: CategorizedError, attemptCount: number): RecoveryAction {
    return {
      type: 'retry',
      delay: this.calculateExponentialBackoff(attemptCount),
      maxAttempts: this.MAX_RETRIES - 1, // Fewer retries for timeouts
      metadata: { increase_timeout: true },
    };
  }

  private handleSlippageError(error: CategorizedError, attemptCount: number): RecoveryAction {
    return {
      type: 'retry',
      delay: 2000,
      maxAttempts: 2, // Only retry once for slippage
      metadata: { adjust_slippage: true, increase_by: 0.5 },
    };
  }

  private handleSystemError(error: CategorizedError, attemptCount: number): RecoveryAction {
    return {
      type: 'retry',
      delay: this.calculateExponentialBackoff(attemptCount),
      maxAttempts: this.MAX_RETRIES,
      fallbackAction: {
        type: 'notify',
        metadata: { reason: 'system_error', requires_investigation: true },
      },
    };
  }

  // ============================================================================
  // Circuit Breaker Pattern
  // ============================================================================

  checkCircuitBreaker(service: string): boolean {
    const breaker = this.getOrCreateCircuitBreaker(service);

    switch (breaker.state) {
      case 'closed':
        return true; // Allow request

      case 'open':
        // Check if timeout has passed
        if (breaker.nextAttemptTime && new Date() >= breaker.nextAttemptTime) {
          this.transitionToHalfOpen(service);
          return true;
        }
        this.logger.warn('Circuit breaker is OPEN', { service });
        return false;

      case 'half_open':
        // Allow limited requests in half-open state
        return breaker.successCount < this.HALF_OPEN_REQUESTS;

      default:
        return true;
    }
  }

  recordSuccess(service: string): void {
    const breaker = this.getOrCreateCircuitBreaker(service);
    breaker.totalRequests++;
    breaker.successCount++;
    breaker.failureCount = 0; // Reset failure count on success

    if (breaker.state === 'half_open' && breaker.successCount >= this.SUCCESS_THRESHOLD) {
      this.transitionToClosed(service);
    }

    this.circuitBreakers.set(service, breaker);
  }

  recordFailure(service: string): void {
    const breaker = this.getOrCreateCircuitBreaker(service);
    breaker.totalRequests++;
    breaker.failureCount++;
    breaker.lastFailureTime = new Date();

    if (breaker.state === 'half_open') {
      this.transitionToOpen(service);
    } else if (breaker.failureCount >= this.FAILURE_THRESHOLD) {
      this.transitionToOpen(service);
    }

    this.circuitBreakers.set(service, breaker);

    // Track error for analytics
    this.errorHistory.push({
      timestamp: new Date(),
      category: ErrorCategory.SYSTEM_ERROR,
      severity: ErrorSeverity.HIGH,
      service,
      recovered: false,
    });
  }

  private getOrCreateCircuitBreaker(service: string): CircuitBreakerState {
    let breaker = this.circuitBreakers.get(service);

    if (!breaker) {
      breaker = {
        service,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
      };
      this.circuitBreakers.set(service, breaker);
    }

    return breaker;
  }

  private transitionToOpen(service: string): void {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return;

    breaker.state = 'open';
    breaker.nextAttemptTime = new Date(Date.now() + this.TIMEOUT_MS);

    this.logger.warn('Circuit breaker transitioned to OPEN', {
      service,
      nextAttempt: breaker.nextAttemptTime,
    });

    this.circuitBreakers.set(service, breaker);
  }

  private transitionToHalfOpen(service: string): void {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return;

    breaker.state = 'half_open';
    breaker.successCount = 0;

    this.logger.log('Circuit breaker transitioned to HALF_OPEN', { service });

    this.circuitBreakers.set(service, breaker);
  }

  private transitionToClosed(service: string): void {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return;

    breaker.state = 'closed';
    breaker.failureCount = 0;
    breaker.successCount = 0;

    this.logger.log('Circuit breaker transitioned to CLOSED', { service });

    this.circuitBreakers.set(service, breaker);
  }

  // ============================================================================
  // Retry Logic
  // ============================================================================

  shouldRetry(error: CategorizedError, attemptCount: number): boolean {
    if (!error.retryable) {
      return false;
    }

    if (attemptCount >= this.MAX_RETRIES) {
      return false;
    }

    // Don't retry security or validation errors
    if (
      error.category === ErrorCategory.SECURITY_ERROR ||
      error.category === ErrorCategory.VALIDATION_ERROR ||
      error.category === ErrorCategory.INSUFFICIENT_FUNDS
    ) {
      return false;
    }

    return true;
  }

  calculateRetryDelay(attemptCount: number, baseDelay?: number): number {
    return this.calculateExponentialBackoff(attemptCount, baseDelay);
  }

  private calculateExponentialBackoff(attemptCount: number, baseDelay?: number): number {
    const base = baseDelay || this.BASE_DELAY_MS;
    const delay = base * Math.pow(2, attemptCount - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    
    return Math.min(delay + jitter, this.MAX_DELAY_MS);
  }

  // ============================================================================
  // Error Analytics
  // ============================================================================

  getErrorStatistics(timeWindow?: number): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recoveryRate: number;
    topServices: Array<{ service: string; errorCount: number }>;
  } {
    const cutoffTime = timeWindow
      ? new Date(Date.now() - timeWindow)
      : new Date(0);

    const relevantErrors = this.errorHistory.filter(
      (e) => e.timestamp >= cutoffTime
    );

    const errorsByCategory = {} as Record<ErrorCategory, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;
    const serviceErrors = new Map<string, number>();

    for (const error of relevantErrors) {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      serviceErrors.set(error.service, (serviceErrors.get(error.service) || 0) + 1);
    }

    const recoveredCount = relevantErrors.filter((e) => e.recovered).length;
    const recoveryRate = relevantErrors.length > 0
      ? (recoveredCount / relevantErrors.length) * 100
      : 0;

    const topServices = Array.from(serviceErrors.entries())
      .map(([service, errorCount]) => ({ service, errorCount }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 5);

    return {
      totalErrors: relevantErrors.length,
      errorsByCategory,
      errorsBySeverity,
      recoveryRate,
      topServices,
    };
  }

  getCircuitBreakerStatus(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values());
  }

  resetCircuitBreaker(service: string): void {
    this.circuitBreakers.delete(service);
    this.logger.log('Circuit breaker reset', { service });
  }

  clearErrorHistory(): void {
    this.errorHistory = [];
    this.logger.log('Error history cleared');
  }
}
