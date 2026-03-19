/**
 * Execution Queue Service
 * Implements concurrent execution with proper queuing and resource management
 * Validates: Requirements 8.1
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface QueuedExecution {
  intentId: number;
  priority: number;
  userTier: 'basic' | 'premium' | 'enterprise';
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  retryCount: number;
}

export interface ExecutionQueueMetrics {
  queueSize: number;
  activeExecutions: number;
  maxConcurrent: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  totalProcessed: number;
}

@Injectable()
export class ExecutionQueueService {
  private readonly logger = new Logger(ExecutionQueueService.name);

  // Queue management
  private queue: QueuedExecution[] = [];
  private activeExecutions: Map<number, QueuedExecution> = new Map();
  private completedExecutions: QueuedExecution[] = [];

  // Configuration
  private maxConcurrentExecutions: number;
  private maxQueueSize: number;
  private maxRetries: number;

  // Metrics
  private totalProcessed = 0;
  private totalWaitTime = 0;
  private totalExecutionTime = 0;

  constructor(private readonly configService: ConfigService) {
    this.maxConcurrentExecutions = this.configService.get<number>(
      'BOT_MAX_CONCURRENT_EXECUTIONS',
      5
    );
    this.maxQueueSize = this.configService.get<number>('BOT_MAX_QUEUE_SIZE', 100);
    this.maxRetries = this.configService.get<number>('BOT_MAX_RETRIES', 3);

    this.logger.log('Execution Queue initialized', {
      maxConcurrent: this.maxConcurrentExecutions,
      maxQueueSize: this.maxQueueSize,
    });
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Add execution to queue with priority
   * Implements proper resource management and queuing (Requirement 8.1)
   */
  enqueue(
    intentId: number,
    userTier: 'basic' | 'premium' | 'enterprise' = 'basic'
  ): boolean {
    // Check if already queued or executing
    if (this.isInQueue(intentId) || this.activeExecutions.has(intentId)) {
      this.logger.warn('Intent already in queue or executing', { intentId });
      return false;
    }

    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      this.logger.warn('Queue is full', {
        queueSize: this.queue.length,
        maxSize: this.maxQueueSize,
      });
      return false;
    }

    // Calculate priority based on user tier
    const priority = this.calculatePriority(userTier);

    const queuedExecution: QueuedExecution = {
      intentId,
      priority,
      userTier,
      queuedAt: new Date(),
      status: 'queued',
      retryCount: 0,
    };

    this.queue.push(queuedExecution);

    // Sort queue by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);

    this.logger.debug('Execution queued', {
      intentId,
      priority,
      userTier,
      queuePosition: this.queue.findIndex((e) => e.intentId === intentId) + 1,
    });

    return true;
  }

  /**
   * Get next execution from queue if capacity available
   * Implements concurrent execution capabilities (Requirement 8.1)
   */
  dequeue(): QueuedExecution | null {
    // Check if we have capacity
    if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
      this.logger.debug('Max concurrent executions reached', {
        active: this.activeExecutions.size,
        max: this.maxConcurrentExecutions,
      });
      return null;
    }

    // Get highest priority item from queue
    const execution = this.queue.shift();

    if (!execution) {
      return null;
    }

    // Mark as executing
    execution.status = 'executing';
    execution.startedAt = new Date();

    // Calculate wait time
    const waitTime = execution.startedAt.getTime() - execution.queuedAt.getTime();
    this.totalWaitTime += waitTime;

    // Add to active executions
    this.activeExecutions.set(execution.intentId, execution);

    this.logger.debug('Execution dequeued', {
      intentId: execution.intentId,
      waitTime: `${waitTime}ms`,
      activeCount: this.activeExecutions.size,
    });

    return execution;
  }

  /**
   * Mark execution as completed
   */
  complete(intentId: number, success: boolean): void {
    const execution = this.activeExecutions.get(intentId);

    if (!execution) {
      this.logger.warn('Execution not found in active set', { intentId });
      return;
    }

    execution.status = success ? 'completed' : 'failed';
    execution.completedAt = new Date();

    // Calculate execution time
    if (execution.startedAt) {
      const executionTime =
        execution.completedAt.getTime() - execution.startedAt.getTime();
      this.totalExecutionTime += executionTime;
    }

    // Remove from active
    this.activeExecutions.delete(intentId);

    // Add to completed history (keep last 100)
    this.completedExecutions.push(execution);
    if (this.completedExecutions.length > 100) {
      this.completedExecutions.shift();
    }

    this.totalProcessed++;

    this.logger.debug('Execution completed', {
      intentId,
      success,
      activeCount: this.activeExecutions.size,
    });
  }

  /**
   * Retry failed execution
   */
  retry(intentId: number): boolean {
    const execution = this.activeExecutions.get(intentId);

    if (!execution) {
      this.logger.warn('Execution not found for retry', { intentId });
      return false;
    }

    if (execution.retryCount >= this.maxRetries) {
      this.logger.warn('Max retries reached', { intentId, retries: execution.retryCount });
      return false;
    }

    // Remove from active
    this.activeExecutions.delete(intentId);

    // Increment retry count and re-queue
    execution.retryCount++;
    execution.status = 'queued';
    execution.queuedAt = new Date();
    delete execution.startedAt;
    delete execution.completedAt;

    this.queue.push(execution);
    this.queue.sort((a, b) => b.priority - a.priority);

    this.logger.log('Execution re-queued for retry', {
      intentId,
      retryCount: execution.retryCount,
    });

    return true;
  }

  // ============================================================================
  // Priority Management
  // ============================================================================

  /**
   * Calculate priority based on user tier
   * Implements load-based prioritization (Requirement 8.3)
   */
  private calculatePriority(userTier: 'basic' | 'premium' | 'enterprise'): number {
    const tierPriorities = {
      basic: 1,
      premium: 5,
      enterprise: 10,
    };

    return tierPriorities[userTier];
  }

  /**
   * Update priority for queued execution
   */
  updatePriority(intentId: number, newPriority: number): boolean {
    const execution = this.queue.find((e) => e.intentId === intentId);

    if (!execution) {
      return false;
    }

    execution.priority = newPriority;
    this.queue.sort((a, b) => b.priority - a.priority);

    this.logger.debug('Priority updated', { intentId, newPriority });

    return true;
  }

  // ============================================================================
  // Queue Queries
  // ============================================================================

  isInQueue(intentId: number): boolean {
    return this.queue.some((e) => e.intentId === intentId);
  }

  isExecuting(intentId: number): boolean {
    return this.activeExecutions.has(intentId);
  }

  getQueuePosition(intentId: number): number {
    const index = this.queue.findIndex((e) => e.intentId === intentId);
    return index >= 0 ? index + 1 : -1;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  hasCapacity(): boolean {
    return this.activeExecutions.size < this.maxConcurrentExecutions;
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  getMetrics(): ExecutionQueueMetrics {
    const averageWaitTime =
      this.totalProcessed > 0 ? this.totalWaitTime / this.totalProcessed : 0;
    const averageExecutionTime =
      this.totalProcessed > 0 ? this.totalExecutionTime / this.totalProcessed : 0;

    return {
      queueSize: this.queue.length,
      activeExecutions: this.activeExecutions.size,
      maxConcurrent: this.maxConcurrentExecutions,
      averageWaitTime,
      averageExecutionTime,
      totalProcessed: this.totalProcessed,
    };
  }

  /**
   * Get detailed queue state
   */
  getQueueState(): {
    queued: QueuedExecution[];
    active: QueuedExecution[];
    recentCompleted: QueuedExecution[];
  } {
    return {
      queued: [...this.queue],
      active: Array.from(this.activeExecutions.values()),
      recentCompleted: this.completedExecutions.slice(-10),
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setMaxConcurrent(max: number): void {
    this.maxConcurrentExecutions = max;
    this.logger.log('Max concurrent executions updated', { max });
  }

  setMaxQueueSize(max: number): void {
    this.maxQueueSize = max;
    this.logger.log('Max queue size updated', { max });
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  clear(): void {
    this.queue = [];
    this.activeExecutions.clear();
    this.completedExecutions = [];
    this.totalProcessed = 0;
    this.totalWaitTime = 0;
    this.totalExecutionTime = 0;
    this.logger.log('Queue cleared');
  }

  removeFromQueue(intentId: number): boolean {
    const index = this.queue.findIndex((e) => e.intentId === intentId);

    if (index >= 0) {
      this.queue.splice(index, 1);
      this.logger.debug('Execution removed from queue', { intentId });
      return true;
    }

    return false;
  }
}
