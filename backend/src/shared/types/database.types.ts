/**
 * Database Types and Interfaces
 * 
 * TypeScript interfaces for all database tables in the NexusAI Protocol.
 * These interfaces match the database schema defined in migrations.
 * 
 * Requirements: 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10
 */

// Enum types for database status fields
export enum IntentStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  PLAN_SUBMITTED = 'PLAN_SUBMITTED',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ExecutionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ExecutionStepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum XCMMessageStatus {
  DISPATCHED = 'DISPATCHED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

/**
 * Intent Table Interface
 * Requirements: 14.3, 14.4
 * 
 * Represents user financial intents with guardrails and execution tracking.
 */
export interface Intent {
  id: string; // bigint as string
  user_address: string; // varchar(42)
  amount: string; // numeric(78, 0) as string for precision
  goal_hash: string; // varchar(66)
  max_slippage_bps: number; // integer
  deadline: string; // bigint as string
  min_yield_bps?: number; // integer, nullable
  max_lock_duration?: number; // integer, nullable
  approved_protocols?: string[]; // text[], nullable
  natural_language_goal?: string; // text, nullable
  status: IntentStatus; // varchar(20)
  assigned_agent?: string; // varchar(42), nullable
  execution_plan_hash?: string; // varchar(66), nullable
  created_at: string; // bigint as string
  updated_at: string; // bigint as string
}

/**
 * Agent Table Interface
 * Requirements: 14.4, 12.6
 * 
 * Represents AI agents with staking, reputation, and performance tracking.
 */
export interface Agent {
  address: string; // varchar(42), primary key
  stake_amount: string; // numeric(78, 0) as string for precision
  reputation_score: number; // integer (0-10000 basis points)
  success_count: number; // integer
  fail_count: number; // integer
  total_executions: number; // integer
  is_active: boolean; // boolean
  metadata_uri?: string; // text, nullable
  metadata_json?: Record<string, any>; // jsonb, nullable
  registered_at: string; // bigint as string
  updated_at: string; // bigint as string
}

/**
 * Execution Table Interface
 * Requirements: 14.5
 * 
 * Represents execution instances for intents with step tracking.
 */
export interface Execution {
  intent_id: string; // bigint as string, primary key and foreign key
  status: ExecutionStatus; // varchar(20)
  total_steps: number; // integer
  completed_steps: number; // integer
  started_at: string; // bigint as string
  completed_at?: string; // bigint as string, nullable
  error_message?: string; // text, nullable
}

/**
 * Execution Step Table Interface
 * Requirements: 14.6
 * 
 * Represents individual steps within an execution plan.
 */
export interface ExecutionStep {
  id: number; // serial, primary key
  intent_id: string; // bigint as string, foreign key
  step_index: number; // integer
  destination_para_id: number; // integer (0 for local execution)
  target_contract?: string; // varchar(42), nullable
  call_data?: string; // text, nullable
  value?: string; // numeric(78, 0) as string, nullable
  status: ExecutionStepStatus; // varchar(20)
  tx_hash?: string; // varchar(66), nullable
  executed_at?: string; // bigint as string, nullable
}

/**
 * XCM Message Table Interface
 * Requirements: 14.7
 * 
 * Represents cross-chain messages sent via XCM with confirmation tracking.
 */
export interface XCMMessage {
  id: number; // serial, primary key
  intent_id: string; // bigint as string, foreign key
  para_id: number; // integer
  xcm_message_hash: string; // varchar(66)
  xcm_message_bytes: string; // text
  status: XCMMessageStatus; // varchar(20)
  dispatched_at: string; // bigint as string
  confirmed_at?: string; // bigint as string, nullable
}

/**
 * Yield Snapshot Table Interface
 * Requirements: 14.8
 * 
 * Represents historical yield data snapshots for analysis and caching.
 */
export interface YieldSnapshot {
  id: number; // serial, primary key
  protocol: string; // varchar(50)
  chain: string; // varchar(50)
  asset: string; // varchar(20)
  apy_bps: number; // integer (basis points)
  tvl_usd?: number; // numeric(20, 2), nullable
  snapshot_at: string; // bigint as string
}

/**
 * Block Table Interface
 * Requirements: 14.9
 * 
 * Represents indexed blockchain blocks for event processing and reorg detection.
 */
export interface Block {
  block_number: string; // bigint as string, primary key
  block_hash: string; // varchar(66)
  timestamp: string; // bigint as string
  indexed_at: string; // bigint as string
}

/**
 * Database Query Result Types
 * 
 * Helper types for common database operations and joins.
 */

// Intent with related data
export interface IntentWithExecution extends Intent {
  execution?: Execution;
  agent?: Pick<Agent, 'address' | 'reputation_score' | 'metadata_json'>;
}

// Agent with performance metrics
export interface AgentWithMetrics extends Agent {
  success_rate: number; // calculated field
  total_volume_handled?: string; // calculated field
  recent_executions?: Execution[];
}

// Execution with steps and XCM messages
export interface ExecutionWithDetails extends Execution {
  steps: ExecutionStep[];
  xcm_messages: XCMMessage[];
  intent: Pick<Intent, 'id' | 'user_address' | 'amount' | 'natural_language_goal'>;
}

// Yield data with historical context
export interface YieldWithHistory extends YieldSnapshot {
  historical_apy: number[]; // calculated field from historical snapshots
  volatility_score: number; // calculated field
}

/**
 * Database Connection and Query Types
 */

// Generic database row type
export type DatabaseRow = Record<string, any>;

// Query result with pagination
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

// Common query options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

/**
 * Type Guards for Runtime Type Checking
 */

export function isIntent(obj: any): obj is Intent {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.user_address === 'string' &&
    typeof obj.amount === 'string' &&
    typeof obj.goal_hash === 'string' &&
    typeof obj.max_slippage_bps === 'number' &&
    typeof obj.deadline === 'string' &&
    Object.values(IntentStatus).includes(obj.status) &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
}

export function isAgent(obj: any): obj is Agent {
  return (
    typeof obj === 'object' &&
    typeof obj.address === 'string' &&
    typeof obj.stake_amount === 'string' &&
    typeof obj.reputation_score === 'number' &&
    typeof obj.success_count === 'number' &&
    typeof obj.fail_count === 'number' &&
    typeof obj.total_executions === 'number' &&
    typeof obj.is_active === 'boolean' &&
    typeof obj.registered_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
}

export function isExecution(obj: any): obj is Execution {
  return (
    typeof obj === 'object' &&
    typeof obj.intent_id === 'string' &&
    Object.values(ExecutionStatus).includes(obj.status) &&
    typeof obj.total_steps === 'number' &&
    typeof obj.completed_steps === 'number' &&
    typeof obj.started_at === 'string'
  );
}

/**
 * Database Table Names
 * 
 * Centralized table name constants to avoid typos and enable refactoring.
 */
export const TABLE_NAMES = {
  INTENTS: 'intents',
  AGENTS: 'agents',
  EXECUTIONS: 'executions',
  EXECUTION_STEPS: 'execution_steps',
  XCM_MESSAGES: 'xcm_messages',
  YIELD_SNAPSHOTS: 'yield_snapshots',
  BLOCKS: 'blocks',
} as const;

/**
 * Database Index Names
 * 
 * Index names for performance optimization queries.
 */
export const INDEX_NAMES = {
  INTENTS_USER_ADDRESS: 'intents_user_address_idx',
  INTENTS_STATUS: 'intents_status_idx',
  INTENTS_ASSIGNED_AGENT: 'intents_assigned_agent_idx',
  INTENTS_CREATED_AT: 'intents_created_at_idx',
  AGENTS_REPUTATION: 'agents_reputation_score_idx',
  AGENTS_IS_ACTIVE: 'agents_is_active_idx',
  EXECUTIONS_STATUS: 'executions_status_idx',
  XCM_MESSAGES_STATUS: 'xcm_messages_status_idx',
  XCM_MESSAGES_PARA_ID: 'xcm_messages_para_id_idx',
  YIELD_SNAPSHOTS_PROTOCOL_TIME: 'yield_snapshots_protocol_snapshot_at_idx',
  YIELD_SNAPSHOTS_ASSET_TIME: 'yield_snapshots_asset_snapshot_at_idx',
  BLOCKS_TIMESTAMP: 'blocks_timestamp_idx',
} as const;