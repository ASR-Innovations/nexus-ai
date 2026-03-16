/**
 * Timelock Manager Service
 * 
 * Manages timelock operations with 2-day delays for critical contract changes.
 * Provides scheduling, execution, and status tracking capabilities.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TimelockRepositoryImpl } from '../repositories/timelock.repository';
import { ContractService } from '../contract.service';
import {
  TimelockOperation,
  TimelockOperationType,
  TimelockStatus,
  CreateTimelockOperationParams,
  TimelockOperationWithDetails,
  TIMELOCK_CONSTANTS
} from '../types/timelock.types';
import { UnsignedTransaction } from '../types/contract.types';

export interface TimelockManager {
  scheduleOperation(operation: CreateTimelockOperationParams): Promise<string>;
  executeOperation(operationId: string): Promise<void>;
  cancelOperation(operationId: string): Promise<void>;
  getOperationStatus(operationId: string): Promise<TimelockOperationWithDetails | null>;
  listPendingOperations(): Promise<TimelockOperation[]>;
  listReadyOperations(): Promise<TimelockOperation[]>;
}

@Injectable()
export class TimelockManagerService implements TimelockManager {
  private readonly logger = new Logger(TimelockManagerService.name);

  constructor(
    private readonly timelockRepository: TimelockRepositoryImpl,
    private readonly contractService: ContractService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Schedule a new timelock operation with 2-day delay
   */
  async scheduleOperation(params: CreateTimelockOperationParams): Promise<string> {
    try {
      // Validate operation parameters
      this.validateOperationParameters(params);

      // Create the timelock operation
      const operation = await this.timelockRepository.create(params);

      this.logger.log(
        `Scheduled ${params.type} operation ${operation.id} for execution at ${operation.executeAt.toISOString()}`
      );

      return operation.id;
    } catch (error) {
      this.logger.error(`Failed to schedule timelock operation:`, error);
      throw error;
    }
  }

  /**
   * Execute a timelock operation if delay period has passed
   */
  async executeOperation(operationId: string): Promise<void> {
    try {
      const operation = await this.timelockRepository.findById(operationId);
      
      if (!operation) {
        throw new Error(`Timelock operation ${operationId} not found`);
      }

      // Check if operation is ready for execution
      if (!this.isOperationReady(operation)) {
        const timeRemaining = operation.executeAt.getTime() - Date.now();
        throw new Error(
          `Operation ${operationId} cannot be executed yet. Time remaining: ${Math.ceil(timeRemaining / (1000 * 60 * 60))} hours`
        );
      }

      if (operation.status !== TimelockStatus.PENDING) {
        throw new Error(`Operation ${operationId} is not in PENDING status (current: ${operation.status})`);
      }

      // Execute the operation based on its type
      const transaction = await this.buildExecutionTransaction(operation);
      
      // For now, we'll mark as ready for execution since we don't have wallet integration
      // In a real implementation, this would submit the transaction and wait for confirmation
      await this.timelockRepository.updateStatus(operationId, TimelockStatus.READY);

      this.logger.log(`Timelock operation ${operationId} is ready for execution`);
      
      // TODO: In production, integrate with wallet service to actually execute the transaction
      // const txHash = await this.walletService.submitTransaction(transaction);
      // await this.timelockRepository.setExecuted(operationId, txHash);

    } catch (error) {
      this.logger.error(`Failed to execute timelock operation ${operationId}:`, error);
      await this.timelockRepository.setFailed(operationId, (error as Error).message);
      throw error;
    }
  }

  /**
   * Cancel a pending timelock operation
   */
  async cancelOperation(operationId: string): Promise<void> {
    try {
      const operation = await this.timelockRepository.findById(operationId);
      
      if (!operation) {
        throw new Error(`Timelock operation ${operationId} not found`);
      }

      if (operation.status !== TimelockStatus.PENDING) {
        throw new Error(`Cannot cancel operation ${operationId} with status ${operation.status}`);
      }

      await this.timelockRepository.setCancelled(operationId);
      
      this.logger.log(`Cancelled timelock operation ${operationId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel timelock operation ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed status of a timelock operation
   */
  async getOperationStatus(operationId: string): Promise<TimelockOperationWithDetails | null> {
    try {
      const operation = await this.timelockRepository.findById(operationId);
      
      if (!operation) {
        return null;
      }

      const now = Date.now();
      const executeTime = operation.executeAt.getTime();
      const canExecute = this.isOperationReady(operation);
      const timeRemaining = canExecute ? 0 : Math.max(0, executeTime - now);

      return {
        ...operation,
        canExecute,
        timeRemaining
      };
    } catch (error) {
      this.logger.error(`Failed to get operation status for ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * List all pending timelock operations
   */
  async listPendingOperations(): Promise<TimelockOperation[]> {
    try {
      return await this.timelockRepository.findPendingOperations();
    } catch (error) {
      this.logger.error('Failed to list pending operations:', error);
      throw error;
    }
  }

  /**
   * List all operations ready for execution
   */
  async listReadyOperations(): Promise<TimelockOperation[]> {
    try {
      return await this.timelockRepository.findReadyOperations();
    } catch (error) {
      this.logger.error('Failed to list ready operations:', error);
      throw error;
    }
  }

  /**
   * Check if an operation is ready for execution (delay period has passed)
   */
  private isOperationReady(operation: TimelockOperation): boolean {
    return Date.now() >= operation.executeAt.getTime() && operation.status === TimelockStatus.PENDING;
  }

  /**
   * Validate operation parameters based on type
   */
  private validateOperationParameters(params: CreateTimelockOperationParams): void {
    if (!params.type || !Object.values(TimelockOperationType).includes(params.type)) {
      throw new Error(`Invalid operation type: ${params.type}`);
    }

    if (!params.parameters || typeof params.parameters !== 'object') {
      throw new Error('Operation parameters must be a valid object');
    }

    if (!params.createdBy || typeof params.createdBy !== 'string') {
      throw new Error('createdBy must be a valid string');
    }

    // Type-specific validation
    switch (params.type) {
      case TimelockOperationType.INTENT_VAULT_CHANGE:
        this.validateIntentVaultChangeParams(params.parameters);
        break;
      case TimelockOperationType.AGENT_REGISTRY_CHANGE:
        this.validateAgentRegistryChangeParams(params.parameters);
        break;
      case TimelockOperationType.EXECUTION_MANAGER_CHANGE:
        this.validateExecutionManagerChangeParams(params.parameters);
        break;
      default:
        throw new Error(`Unsupported operation type: ${params.type}`);
    }
  }

  /**
   * Validate parameters for IntentVault changes
   */
  private validateIntentVaultChangeParams(params: Record<string, any>): void {
    if (params.newAddress && typeof params.newAddress !== 'string') {
      throw new Error('newAddress must be a valid string');
    }
    
    // Add more specific validation as needed
  }

  /**
   * Validate parameters for AgentRegistry changes
   */
  private validateAgentRegistryChangeParams(params: Record<string, any>): void {
    if (params.newAddress && typeof params.newAddress !== 'string') {
      throw new Error('newAddress must be a valid string');
    }
    
    // Add more specific validation as needed
  }

  /**
   * Validate parameters for ExecutionManager changes
   */
  private validateExecutionManagerChangeParams(params: Record<string, any>): void {
    if (params.newAddress && typeof params.newAddress !== 'string') {
      throw new Error('newAddress must be a valid string');
    }
    
    // Add more specific validation as needed
  }

  /**
   * Build the transaction for executing a timelock operation
   */
  private async buildExecutionTransaction(operation: TimelockOperation): Promise<UnsignedTransaction> {
    switch (operation.type) {
      case TimelockOperationType.INTENT_VAULT_CHANGE:
        return this.contractService.executeIntentVaultChange();
        
      case TimelockOperationType.AGENT_REGISTRY_CHANGE:
        // Build agent registry change transaction
        throw new Error('Agent registry changes not yet implemented');
        
      case TimelockOperationType.EXECUTION_MANAGER_CHANGE:
        // Build execution manager change transaction
        throw new Error('Execution manager changes not yet implemented');
        
      default:
        throw new Error(`Unsupported operation type for execution: ${operation.type}`);
    }
  }

  /**
   * Cleanup old completed operations (for maintenance)
   */
  async cleanupOldOperations(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      const deletedCount = await this.timelockRepository.deleteOldOperations(cutoffDate);
      
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old timelock operations`);
      }
      
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old operations:', error);
      throw error;
    }
  }
}