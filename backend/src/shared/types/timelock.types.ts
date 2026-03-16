/**
 * Timelock Types
 * 
 * TypeScript interfaces for timelock operations and management.
 */

export enum TimelockOperationType {
  INTENT_VAULT_CHANGE = 'INTENT_VAULT_CHANGE',
  AGENT_REGISTRY_CHANGE = 'AGENT_REGISTRY_CHANGE',
  EXECUTION_MANAGER_CHANGE = 'EXECUTION_MANAGER_CHANGE'
}

export enum TimelockStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

export interface TimelockOperation {
  id: string;
  type: TimelockOperationType;
  scheduledAt: Date;
  executeAt: Date;
  executedAt?: Date;
  cancelledAt?: Date;
  parameters: Record<string, any>;
  status: TimelockStatus;
  createdBy: string;
  transactionHash?: string;
  errorMessage?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTimelockOperationParams {
  type: TimelockOperationType;
  parameters: Record<string, any>;
  createdBy: string;
  delayDays?: number; // Default 2 days
}

export interface TimelockOperationWithDetails extends TimelockOperation {
  canExecute: boolean;
  timeRemaining?: number; // milliseconds until execution is available
}

export interface TimelockRepository {
  // Basic CRUD operations
  findById(id: string): Promise<TimelockOperation | null>;
  create(data: CreateTimelockOperationParams): Promise<TimelockOperation>;
  update(id: string, data: Partial<TimelockOperation>): Promise<TimelockOperation | null>;
  delete(id: string): Promise<boolean>;
  
  // Status-based queries
  findByStatus(status: TimelockStatus): Promise<TimelockOperation[]>;
  findPendingOperations(): Promise<TimelockOperation[]>;
  findReadyOperations(): Promise<TimelockOperation[]>;
  findByType(type: TimelockOperationType): Promise<TimelockOperation[]>;
  
  // Status updates
  updateStatus(id: string, status: TimelockStatus): Promise<boolean>;
  setExecuted(id: string, transactionHash: string): Promise<boolean>;
  setCancelled(id: string): Promise<boolean>;
  setFailed(id: string, errorMessage: string): Promise<boolean>;
  
  // Cleanup operations
  deleteOldOperations(olderThan: Date): Promise<number>;
}

export const TIMELOCK_CONSTANTS = {
  DEFAULT_DELAY_DAYS: 2,
  DEFAULT_DELAY_MS: 2 * 24 * 60 * 60 * 1000, // 2 days in milliseconds
  TABLE_NAME: 'timelock_operations'
} as const;