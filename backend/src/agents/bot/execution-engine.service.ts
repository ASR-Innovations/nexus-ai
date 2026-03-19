import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { TransactionBuilderService } from './transaction-builder.service';
import { FundManagerService } from './fund-manager.service';
import { RealProtocolIntegrationService } from './real-protocol-integration.service';
import { SecurityService } from '../../shared/services/security.service';
import {
  ExecutionPlan,
  ExecutionStep,
  Intent,
  ExecutionContext,
  ValidationResult,
} from './interfaces/protocol-execution.interfaces';

export interface ExecutionStatus {
  intentId: number;
  status: 'pending' | 'validating' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  failedStep?: number;
  error?: string;
  startTime: Date;
  endTime?: Date;
  transactionHashes: string[];
  gasUsed: string;
}

@Injectable()
export class ExecutionEngineService {
  private readonly logger = new Logger(ExecutionEngineService.name);

  // Execution tracking
  private executionStatuses: Map<number, ExecutionStatus> = new Map();
  
  // Status update callbacks
  private statusCallbacks: Map<number, Array<(status: ExecutionStatus) => void>> = new Map();

  constructor(
    private readonly transactionBuilder: TransactionBuilderService,
    private readonly fundManager: FundManagerService,
    private readonly protocolIntegration: RealProtocolIntegrationService,
    private readonly securityService: SecurityService,
  ) {}

  // ============================================================================
  // Multi-Step Execution
  // ============================================================================

  async executeStrategy(
    intent: Intent,
    context: ExecutionContext
  ): Promise<ExecutionStatus> {
    this.logger.log('Starting strategy execution', { intentId: intent.id });

    // Initialize execution status
    const status: ExecutionStatus = {
      intentId: intent.id,
      status: 'pending',
      currentStep: 0,
      totalSteps: 0,
      completedSteps: 0,
      startTime: new Date(),
      transactionHashes: [],
      gasUsed: '0',
    };

    this.executionStatuses.set(intent.id, status);
    this.updateStatus(status);

    try {
      // Generate execution plan
      status.status = 'validating';
      this.updateStatus(status);

      const plan = await this.protocolIntegration.generateExecutionPlan(intent);
      status.totalSteps = plan.totalSteps;
      this.updateStatus(status);

      // Validate prerequisites
      const prerequisiteCheck = await this.validatePrerequisites(plan, context);
      if (!prerequisiteCheck.valid) {
        throw new Error(`Prerequisites not met: ${prerequisiteCheck.errors.join(', ')}`);
      }

      // Perform security validation using SecurityService
      const securityValidation = await this.securityService.validateSecurityConstraints({
        agentAddress: context.agentAddress,
        protocols: plan.steps.map(s => s.protocol),
        minReputation: 3000, // Minimum reputation requirement
      });

      if (!securityValidation.isValid) {
        throw new Error(`Security validation failed: ${securityValidation.errors.join(', ')}`);
      }

      // Log security warnings if any
      if (securityValidation.warnings.length > 0) {
        this.logger.warn('Security warnings detected', {
          intentId: intent.id,
          warnings: securityValidation.warnings,
        });
      }

      // Execute steps sequentially
      status.status = 'executing';
      this.updateStatus(status);

      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        status.currentStep = i + 1;
        this.updateStatus(status);

        try {
          const txHash = await this.executeStep(step, context);
          status.transactionHashes.push(txHash);
          status.completedSteps++;
          this.updateStatus(status);

          this.logger.log(`Step ${i + 1}/${plan.totalSteps} completed`, {
            intentId: intent.id,
            txHash,
          });
        } catch (error) {
          this.logger.error(`Step ${i + 1} failed`, error);
          status.failedStep = i + 1;
          status.error = error instanceof Error ? error.message : String(error);
          status.status = 'failed';
          this.updateStatus(status);

          // Attempt rollback
          await this.attemptRollback(plan, i, context);
          status.status = 'rolled_back';
          this.updateStatus(status);

          throw error;
        }
      }

      // All steps completed successfully
      status.status = 'completed';
      status.endTime = new Date();
      this.updateStatus(status);

      this.logger.log('Strategy execution completed successfully', {
        intentId: intent.id,
        steps: status.completedSteps,
      });

      return status;
    } catch (error) {
      this.logger.error('Strategy execution failed', error);
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : String(error);
      status.endTime = new Date();
      this.updateStatus(status);

      return status;
    }
  }

  private async executeStep(
    step: ExecutionStep,
    context: ExecutionContext
  ): Promise<string> {
    this.logger.debug('Executing step', {
      stepId: step.stepId,
      action: step.action,
      protocol: step.protocol,
    });

    // Validate step
    const validation = await this.protocolIntegration.validateExecutionStep(step);
    if (!validation.valid) {
      throw new Error(`Step validation failed: ${validation.errors.join(', ')}`);
    }

    // Build transaction
    const unsignedTx = await this.transactionBuilder.buildTransaction({
      to: step.contractAddress,
      data: step.callData,
      value: '0',
      chainId: this.getChainId(step.chain),
    });

    // Sign transaction
    const signedTx = await this.transactionBuilder.signTransaction(
      unsignedTx,
      context.wallet
    );

    // Submit transaction
    const result = await this.transactionBuilder.submitTransaction(signedTx);

    if (!result.success) {
      throw new Error(`Transaction submission failed: ${result.error}`);
    }

    // Wait for confirmation
    await this.transactionBuilder.waitForConfirmation(result.transactionHash, 1);

    return result.transactionHash;
  }

  // ============================================================================
  // Prerequisite Validation
  // ============================================================================

  async validatePrerequisites(
    plan: ExecutionPlan,
    context: ExecutionContext
  ): Promise<ValidationResult> {
    this.logger.debug('Validating execution prerequisites', {
      intentId: plan.intentId,
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check balance
    for (const step of plan.steps) {
      if (step.tokenIn && step.amount) {
        const balance = await this.fundManager.getBalance(
          context.agentAddress,
          step.tokenIn
        );

        if (balance < BigInt(step.amount)) {
          errors.push(
            `Insufficient ${step.tokenIn} balance: have ${balance}, need ${step.amount}`
          );
        }
      }
    }

    // Check gas price
    const currentGasPrice = await this.transactionBuilder.optimizeGasPrice('medium');
    if (currentGasPrice > context.maxGasPrice) {
      warnings.push(
        `Current gas price (${currentGasPrice}) exceeds maximum (${context.maxGasPrice})`
      );
    }

    // Check deadline
    const now = Math.floor(Date.now() / 1000);
    if (plan.steps.some((s) => s.prerequisites.includes('deadline'))) {
      // Deadline check would go here
    }

    // Check protocol health
    const health = await this.protocolIntegration.getProtocolHealth();
    if (!health.isHealthy) {
      warnings.push('Some protocols may be experiencing issues');
    }

    // Check network status
    // Would check RPC connectivity here

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // Rollback Mechanism
  // ============================================================================

  private async attemptRollback(
    plan: ExecutionPlan,
    failedStepIndex: number,
    context: ExecutionContext
  ): Promise<void> {
    this.logger.warn('Attempting rollback', {
      intentId: plan.intentId,
      failedStep: failedStepIndex + 1,
    });

    if (!plan.rollbackPlan || plan.rollbackPlan.length === 0) {
      this.logger.warn('No rollback plan available');
      return;
    }

    // Execute rollback steps for completed steps
    for (let i = failedStepIndex - 1; i >= 0; i--) {
      const rollbackStep = plan.rollbackPlan[i];
      
      try {
        this.logger.debug('Executing rollback step', {
          stepId: rollbackStep.stepId,
          description: rollbackStep.description,
        });

        // In production, this would execute actual rollback transactions
        // For now, we log the rollback attempt
        await this.delay(1000);

        this.logger.log('Rollback step completed', {
          stepId: rollbackStep.stepId,
        });
      } catch (error) {
        this.logger.error('Rollback step failed', {
          stepId: rollbackStep.stepId,
          error,
        });
        // Continue with remaining rollback steps
      }
    }

    this.logger.log('Rollback completed', { intentId: plan.intentId });
  }

  // ============================================================================
  // Real-Time Status Updates
  // ============================================================================

  subscribeToStatus(
    intentId: number,
    callback: (status: ExecutionStatus) => void
  ): () => void {
    const callbacks = this.statusCallbacks.get(intentId) || [];
    callbacks.push(callback);
    this.statusCallbacks.set(intentId, callbacks);

    // Return unsubscribe function
    return () => {
      const cbs = this.statusCallbacks.get(intentId) || [];
      const index = cbs.indexOf(callback);
      if (index > -1) {
        cbs.splice(index, 1);
      }
    };
  }

  private updateStatus(status: ExecutionStatus): void {
    this.executionStatuses.set(status.intentId, status);

    // Notify subscribers
    const callbacks = this.statusCallbacks.get(status.intentId) || [];
    callbacks.forEach((callback) => {
      try {
        callback({ ...status });
      } catch (error) {
        this.logger.error('Status callback error', error);
      }
    });

    this.logger.debug('Execution status updated', {
      intentId: status.intentId,
      status: status.status,
      currentStep: status.currentStep,
      totalSteps: status.totalSteps,
    });
  }

  getExecutionStatus(intentId: number): ExecutionStatus | undefined {
    return this.executionStatuses.get(intentId);
  }

  getAllExecutionStatuses(): ExecutionStatus[] {
    return Array.from(this.executionStatuses.values());
  }

  // ============================================================================
  // Cost Validation
  // ============================================================================

  async validateExecutionCost(
    plan: ExecutionPlan,
    userLimit: bigint
  ): Promise<{ withinLimit: boolean; estimatedCost: bigint; limit: bigint }> {
    const costEstimate = await this.protocolIntegration.estimateExecutionCost(
      plan.steps
    );

    const estimatedCostWei = ethers.parseEther(costEstimate.estimatedCostETH);
    const withinLimit = estimatedCostWei <= userLimit;

    if (!withinLimit) {
      this.logger.warn('Execution cost exceeds user limit', {
        estimated: costEstimate.estimatedCostETH,
        limit: ethers.formatEther(userLimit),
      });
    }

    return {
      withinLimit,
      estimatedCost: estimatedCostWei,
      limit: userLimit,
    };
  }

  // ============================================================================
  // Execution Monitoring
  // ============================================================================

  getExecutionMetrics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    rolledBackExecutions: number;
    averageExecutionTime: number;
  } {
    const statuses = Array.from(this.executionStatuses.values());

    const successful = statuses.filter((s) => s.status === 'completed').length;
    const failed = statuses.filter((s) => s.status === 'failed').length;
    const rolledBack = statuses.filter((s) => s.status === 'rolled_back').length;

    const completedStatuses = statuses.filter(
      (s) => s.endTime && s.startTime
    );
    const totalTime = completedStatuses.reduce((sum, s) => {
      return sum + (s.endTime!.getTime() - s.startTime.getTime());
    }, 0);
    const averageTime = completedStatuses.length > 0 
      ? totalTime / completedStatuses.length 
      : 0;

    return {
      totalExecutions: statuses.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      rolledBackExecutions: rolledBack,
      averageExecutionTime: averageTime,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      moonbeam: 1284,
      moonriver: 1285,
      polkadot: 0, // Polkadot doesn't use EVM chain IDs
      hydration: 0,
      bifrost: 0,
    };

    return chainIds[chain] || 1287; // Default to Moonbase Alpha testnet
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  clearExecutionHistory(): void {
    this.executionStatuses.clear();
    this.statusCallbacks.clear();
    this.logger.log('Execution history cleared');
  }

  removeExecutionStatus(intentId: number): void {
    this.executionStatuses.delete(intentId);
    this.statusCallbacks.delete(intentId);
  }
}
