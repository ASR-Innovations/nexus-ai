/**
 * Batch Processor Service
 * Implements batch processing optimization for similar operations
 * Validates: Requirements 8.6, 8.7
 */

import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { TransactionBuilderService } from './transaction-builder.service';
import { UnsignedTransaction } from './interfaces/protocol-execution.interfaces';

export interface BatchGroup {
  id: string;
  chainId: number;
  transactions: UnsignedTransaction[];
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedSavings: string;
}

export interface BatchMetrics {
  totalBatches: number;
  totalTransactions: number;
  averageBatchSize: number;
  totalGasSavings: string;
  processingTime: number;
}

@Injectable()
export class BatchProcessorService {
  private readonly logger = new Logger(BatchProcessorService.name);

  // Batch groups waiting to be processed
  private pendingBatches: Map<string, BatchGroup> = new Map();

  // Batch configuration
  private readonly maxBatchSize = 50;
  private readonly batchWindowMs = 5000; // 5 seconds
  private readonly minBatchSize = 2;

  // Metrics
  private totalBatches = 0;
  private totalTransactions = 0;
  private totalGasSavings = BigInt(0);

  // Batch timers
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly transactionBuilder: TransactionBuilderService) {
    this.logger.log('Batch Processor initialized', {
      maxBatchSize: this.maxBatchSize,
      batchWindow: this.batchWindowMs,
    });
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Add transaction to batch queue
   * Implements batch processing optimization (Requirement 8.6)
   */
  addToBatch(tx: UnsignedTransaction): string {
    const batchKey = this.getBatchKey(tx);
    let batch = this.pendingBatches.get(batchKey);

    if (!batch) {
      batch = {
        id: batchKey,
        chainId: tx.chainId,
        transactions: [],
        createdAt: new Date(),
        status: 'pending',
        estimatedSavings: '0',
      };
      this.pendingBatches.set(batchKey, batch);

      // Start batch timer
      this.startBatchTimer(batchKey);
    }

    batch.transactions.push(tx);

    this.logger.debug('Transaction added to batch', {
      batchKey,
      batchSize: batch.transactions.length,
    });

    // Process immediately if batch is full
    if (batch.transactions.length >= this.maxBatchSize) {
      this.processBatch(batchKey);
    }

    return batchKey;
  }

  /**
   * Process a batch of transactions
   * Optimizes gas costs across multiple transactions (Requirement 8.7)
   */
  async processBatch(batchKey: string): Promise<BatchGroup | null> {
    const batch = this.pendingBatches.get(batchKey);

    if (!batch) {
      this.logger.warn('Batch not found', { batchKey });
      return null;
    }

    // Clear timer if exists
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Check minimum batch size
    if (batch.transactions.length < this.minBatchSize) {
      this.logger.debug('Batch too small, processing individually', {
        batchKey,
        size: batch.transactions.length,
      });
      // Process individually
      return null;
    }

    batch.status = 'processing';

    try {
      this.logger.log('Processing batch', {
        batchKey,
        size: batch.transactions.length,
      });

      // Optimize gas prices for the batch
      const optimizedTxs = await this.transactionBuilder.optimizeBatchGasPrices(
        batch.transactions,
        'medium'
      );

      // Calculate gas savings
      const originalCost = this.calculateTotalCost(batch.transactions);
      const optimizedCost = this.calculateTotalCost(optimizedTxs);
      const savings = originalCost - optimizedCost;

      batch.estimatedSavings = ethers.formatEther(savings);
      batch.transactions = optimizedTxs;
      batch.status = 'completed';

      // Update metrics
      this.totalBatches++;
      this.totalTransactions += batch.transactions.length;
      this.totalGasSavings += savings;

      this.logger.log('Batch processed successfully', {
        batchKey,
        size: batch.transactions.length,
        savings: batch.estimatedSavings,
      });

      // Remove from pending
      this.pendingBatches.delete(batchKey);

      return batch;
    } catch (error) {
      this.logger.error('Batch processing failed', { batchKey, error });
      batch.status = 'failed';
      return batch;
    }
  }

  /**
   * Process all pending batches
   */
  async processAllBatches(): Promise<BatchGroup[]> {
    const batchKeys = Array.from(this.pendingBatches.keys());
    const results: BatchGroup[] = [];

    for (const key of batchKeys) {
      const result = await this.processBatch(key);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // ============================================================================
  // Batch Grouping
  // ============================================================================

  /**
   * Generate batch key for grouping similar transactions
   */
  private getBatchKey(tx: UnsignedTransaction): string {
    // Group by chain and contract address
    return `${tx.chainId}:${tx.to}`;
  }

  /**
   * Check if transactions can be batched together
   */
  canBatch(tx1: UnsignedTransaction, tx2: UnsignedTransaction): boolean {
    // Same chain and same contract
    return tx1.chainId === tx2.chainId && tx1.to === tx2.to;
  }

  // ============================================================================
  // Batch Optimization
  // ============================================================================

  /**
   * Optimize batch for gas efficiency
   * Implements gas cost optimization (Requirement 8.7)
   */
  async optimizeBatch(transactions: UnsignedTransaction[]): Promise<{
    optimizedTransactions: UnsignedTransaction[];
    originalCost: bigint;
    optimizedCost: bigint;
    savings: bigint;
    savingsPercentage: number;
  }> {
    if (transactions.length === 0) {
      return {
        optimizedTransactions: [],
        originalCost: BigInt(0),
        optimizedCost: BigInt(0),
        savings: BigInt(0),
        savingsPercentage: 0,
      };
    }

    // Calculate original cost
    const originalCost = this.calculateTotalCost(transactions);

    // Optimize gas prices
    const optimizedTransactions = await this.transactionBuilder.optimizeBatchGasPrices(
      transactions,
      'medium'
    );

    // Calculate optimized cost
    const optimizedCost = this.calculateTotalCost(optimizedTransactions);

    // Calculate savings
    const savings = originalCost - optimizedCost;
    const savingsPercentage =
      originalCost > 0 ? Number((savings * BigInt(10000)) / originalCost) / 100 : 0;

    this.logger.debug('Batch optimized', {
      count: transactions.length,
      originalCost: ethers.formatEther(originalCost),
      optimizedCost: ethers.formatEther(optimizedCost),
      savings: ethers.formatEther(savings),
      savingsPercentage: `${savingsPercentage.toFixed(2)}%`,
    });

    return {
      optimizedTransactions,
      originalCost,
      optimizedCost,
      savings,
      savingsPercentage,
    };
  }

  /**
   * Calculate total cost for a batch of transactions
   */
  private calculateTotalCost(transactions: UnsignedTransaction[]): bigint {
    return transactions.reduce((total, tx) => {
      return total + tx.gasLimit * tx.gasPrice;
    }, BigInt(0));
  }

  /**
   * Estimate savings from batching
   */
  async estimateBatchSavings(
    transactions: UnsignedTransaction[]
  ): Promise<{
    individualCost: string;
    batchCost: string;
    savings: string;
    savingsPercentage: number;
  }> {
    // Calculate individual processing cost
    const individualCost = this.calculateTotalCost(transactions);

    // Estimate batch cost (typically 10-20% savings)
    const batchCostBigInt = (individualCost * BigInt(85)) / BigInt(100); // 15% savings estimate
    const savings = individualCost - batchCostBigInt;
    const savingsPercentage = 15; // Estimated

    return {
      individualCost: ethers.formatEther(individualCost),
      batchCost: ethers.formatEther(batchCostBigInt),
      savings: ethers.formatEther(savings),
      savingsPercentage,
    };
  }

  // ============================================================================
  // Batch Timing
  // ============================================================================

  /**
   * Start timer for batch processing
   */
  private startBatchTimer(batchKey: string): void {
    const timer = setTimeout(() => {
      this.processBatch(batchKey);
    }, this.batchWindowMs);

    this.batchTimers.set(batchKey, timer);

    this.logger.debug('Batch timer started', {
      batchKey,
      window: this.batchWindowMs,
    });
  }

  /**
   * Cancel batch timer
   */
  private cancelBatchTimer(batchKey: string): void {
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }
  }

  // ============================================================================
  // Batch Queries
  // ============================================================================

  getBatch(batchKey: string): BatchGroup | undefined {
    return this.pendingBatches.get(batchKey);
  }

  getAllBatches(): BatchGroup[] {
    return Array.from(this.pendingBatches.values());
  }

  getPendingBatchCount(): number {
    return this.pendingBatches.size;
  }

  getBatchSize(batchKey: string): number {
    const batch = this.pendingBatches.get(batchKey);
    return batch ? batch.transactions.length : 0;
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  getMetrics(): BatchMetrics {
    const averageBatchSize =
      this.totalBatches > 0 ? this.totalTransactions / this.totalBatches : 0;

    return {
      totalBatches: this.totalBatches,
      totalTransactions: this.totalTransactions,
      averageBatchSize,
      totalGasSavings: ethers.formatEther(this.totalGasSavings),
      processingTime: 0, // Would track actual processing time
    };
  }

  /**
   * Get detailed batch statistics
   */
  getStatistics(): {
    pending: number;
    totalProcessed: number;
    averageBatchSize: number;
    totalSavings: string;
    largestBatch: number;
  } {
    const metrics = this.getMetrics();
    const batches = Array.from(this.pendingBatches.values());
    const largestBatch = batches.reduce(
      (max, batch) => Math.max(max, batch.transactions.length),
      0
    );

    return {
      pending: this.pendingBatches.size,
      totalProcessed: this.totalBatches,
      averageBatchSize: metrics.averageBatchSize,
      totalSavings: metrics.totalGasSavings,
      largestBatch,
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  clear(): void {
    // Cancel all timers
    for (const timer of Array.from(this.batchTimers.values())) {
      clearTimeout(timer);
    }

    this.batchTimers.clear();
    this.pendingBatches.clear();

    this.logger.log('Batch processor cleared');
  }

  /**
   * Remove specific batch
   */
  removeBatch(batchKey: string): boolean {
    this.cancelBatchTimer(batchKey);
    const deleted = this.pendingBatches.delete(batchKey);

    if (deleted) {
      this.logger.debug('Batch removed', { batchKey });
    }

    return deleted;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.totalBatches = 0;
    this.totalTransactions = 0;
    this.totalGasSavings = BigInt(0);
    this.logger.log('Batch metrics reset');
  }
}
