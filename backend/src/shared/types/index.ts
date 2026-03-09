/**
 * Shared Types Index
 * 
 * Central export point for all shared types used across the NexusAI Protocol backend.
 */

// Database types
export {
  IntentStatus,
  ExecutionStatus,
  ExecutionStepStatus,
  XCMMessageStatus,
  Intent,
  Agent,
  Execution,
  ExecutionStep as DbExecutionStep, // Rename to avoid conflict
  XCMMessage,
  YieldSnapshot,
  Block,
  IntentWithExecution,
  AgentWithMetrics,
  ExecutionWithDetails,
  YieldWithHistory,
  PaginatedResult,
  QueryOptions,
  TABLE_NAMES,
  INDEX_NAMES,
  isIntent,
  isAgent,
  isExecution,
} from './database.types';

// API and business logic types
export {
  IntentParams,
  ParseResult,
  YieldOption,
  Strategy,
  RiskScore,
  RiskAssessment,
  ExecutionPlan,
  ExecutionStep as ApiExecutionStep, // Rename to avoid conflict
  Portfolio,
  Balance,
  YieldPosition,
  ChatMessage,
  ExecutionUpdate,
} from './api.types';

// Database service types
export * from './database.service.types';

// Contract types
export {
  // Contract interfaces and enums (note: these conflict with database types, so we prefix them)
  Intent as ContractIntent,
  IntentStatus as ContractIntentStatus,
  Agent as ContractAgent,
  Execution as ContractExecution,
  ExecutionStatus as ContractExecutionStatus,
  ExecutionStep as ContractExecutionStep,
  
  // Event interfaces
  IntentCreatedEvent,
  IntentAssignedEvent,
  PlanSubmittedEvent,
  PlanApprovedEvent,
  IntentExecutedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  FundsReturnedEvent,
  IntentCancelledEvent,
  IntentExpiredEvent,
  AgentRegisteredEvent,
  AgentSlashedEvent,
  ReputationUpdatedEvent,
  AgentDeactivatedEvent,
  ExecutionStartedEvent,
  StepExecutedEvent,
  XCMSentEvent,
  ExecutionDispatchedEvent,
  
  // Transaction building types
  UnsignedTransaction as ContractUnsignedTransaction,
  CreateIntentParams,
  RegisterAgentParams,
  ExecuteIntentParams,
  
  // Constants
  CONTRACT_CONSTANTS,
  PARACHAIN_IDS,
} from './contract.types';

// Re-export commonly used types for convenience
export type {
  // These are already exported above, so we don't need to re-export them
  // Intent,
  // Agent,
  // Execution,
  // ExecutionStep as DbExecutionStep,
  // XCMMessage,
  // YieldSnapshot,
  // Block,
  // IntentWithExecution,
  // AgentWithMetrics,
  // ExecutionWithDetails,
  // YieldWithHistory,
  // PaginatedResult,
  // QueryOptions,
  
  // API types
  // API types (already exported via export * from './api.types')
  // IntentParams,
  // Strategy,
  // YieldOption,
  // RiskScore,
  // RiskAssessment,
  // ExecutionPlan,
  // ExecutionStep as ApiExecutionStep,
  // Portfolio,
  // Balance,
  // YieldPosition,
  // ChatMessage,
  // ExecutionUpdate,
  // GasEstimate,
  // UnsignedTransaction,
  
  // Database service types
  // DatabaseService,
  // IntentRepository,
  // AgentRepository,
  // ExecutionRepository,
  // XCMMessageRepository,
  // YieldSnapshotRepository,
  // BlockRepository,
  // DatabaseTransaction,
  // QueryBuilder,
} from './database.types';