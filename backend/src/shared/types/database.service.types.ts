/**
 * Database Service Interface Types
 * 
 * TypeScript interfaces for database service methods and repository patterns.
 * These define the contract for database operations across all services.
 */

import {
  Intent,
  Agent,
  Execution,
  ExecutionStep,
  XCMMessage,
  YieldSnapshot,
  Block,
  IntentWithExecution,
  AgentWithMetrics,
  ExecutionWithDetails,
  PaginatedResult,
  QueryOptions,
  IntentStatus,
  ExecutionStatus,
  XCMMessageStatus,
} from './database.types';

/**
 * Base Repository Interface
 * 
 * Generic interface for common CRUD operations.
 */
export interface BaseRepository<T, K = string> {
  findById(id: K): Promise<T | null>;
  findMany(options?: QueryOptions): Promise<PaginatedResult<T>>;
  create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  update(id: K, data: Partial<T>): Promise<T | null>;
  delete(id: K): Promise<boolean>;
  exists(id: K): Promise<boolean>;
}

/**
 * Intent Repository Interface
 */
export interface IntentRepository extends BaseRepository<Intent, string> {
  // Intent-specific queries
  findByUserAddress(userAddress: string, options?: QueryOptions): Promise<PaginatedResult<Intent>>;
  findByStatus(status: IntentStatus, options?: QueryOptions): Promise<PaginatedResult<Intent>>;
  findByAgent(agentAddress: string, options?: QueryOptions): Promise<PaginatedResult<Intent>>;
  findWithExecution(intentId: string): Promise<IntentWithExecution | null>;
  
  // Status updates
  updateStatus(intentId: string, status: IntentStatus): Promise<boolean>;
  assignAgent(intentId: string, agentAddress: string): Promise<boolean>;
  setExecutionPlanHash(intentId: string, planHash: string): Promise<boolean>;
  
  // Bulk operations
  findExpiredIntents(currentTimestamp: string): Promise<Intent[]>;
  findPendingIntents(limit?: number): Promise<Intent[]>;
}

/**
 * Agent Repository Interface
 */
export interface AgentRepository extends BaseRepository<Agent, string> {
  // Agent-specific queries
  findActiveAgents(options?: QueryOptions): Promise<PaginatedResult<Agent>>;
  findTopAgentsByReputation(limit: number): Promise<Agent[]>;
  findWithMetrics(agentAddress: string): Promise<AgentWithMetrics | null>;
  
  // Reputation and stake updates
  updateReputation(agentAddress: string, newScore: number): Promise<boolean>;
  updateStake(agentAddress: string, newStake: string): Promise<boolean>;
  recordSuccess(agentAddress: string): Promise<boolean>;
  recordFailure(agentAddress: string, slashAmount: string): Promise<boolean>;
  
  // Status management
  activateAgent(agentAddress: string): Promise<boolean>;
  deactivateAgent(agentAddress: string): Promise<boolean>;
  
  // Metadata management
  updateMetadata(agentAddress: string, metadataJson: Record<string, any>): Promise<boolean>;
}

/**
 * Execution Repository Interface
 */
export interface ExecutionRepository extends BaseRepository<Execution, string> {
  // Execution-specific queries
  findByStatus(status: ExecutionStatus, options?: QueryOptions): Promise<PaginatedResult<Execution>>;
  findWithDetails(intentId: string): Promise<ExecutionWithDetails | null>;
  findByAgent(agentAddress: string, options?: QueryOptions): Promise<PaginatedResult<Execution>>;
  
  // Status and progress updates
  updateStatus(intentId: string, status: ExecutionStatus): Promise<boolean>;
  updateProgress(intentId: string, completedSteps: number): Promise<boolean>;
  setCompleted(intentId: string, completedAt: string): Promise<boolean>;
  setFailed(intentId: string, errorMessage: string): Promise<boolean>;
  
  // Step management
  addStep(step: Omit<ExecutionStep, 'id'>): Promise<ExecutionStep>;
  updateStep(stepId: number, data: Partial<ExecutionStep>): Promise<boolean>;
  getSteps(intentId: string): Promise<ExecutionStep[]>;
}

/**
 * XCM Message Repository Interface
 */
export interface XCMMessageRepository extends BaseRepository<XCMMessage, number> {
  // XCM-specific queries
  findByIntentId(intentId: string): Promise<XCMMessage[]>;
  findByStatus(status: XCMMessageStatus, options?: QueryOptions): Promise<PaginatedResult<XCMMessage>>;
  findByParaId(paraId: number, options?: QueryOptions): Promise<PaginatedResult<XCMMessage>>;
  findPendingConfirmations(): Promise<XCMMessage[]>;
  
  // Status updates
  updateStatus(messageId: number, status: XCMMessageStatus): Promise<boolean>;
  setConfirmed(messageId: number, confirmedAt: string): Promise<boolean>;
  setFailed(messageId: number): Promise<boolean>;
  
  // Bulk operations
  findUnconfirmedMessages(olderThan: string): Promise<XCMMessage[]>;
}

/**
 * Yield Snapshot Repository Interface
 */
export interface YieldSnapshotRepository extends BaseRepository<YieldSnapshot, number> {
  // Yield-specific queries
  findByProtocol(protocol: string, options?: QueryOptions): Promise<PaginatedResult<YieldSnapshot>>;
  findByAsset(asset: string, options?: QueryOptions): Promise<PaginatedResult<YieldSnapshot>>;
  findLatestByProtocol(protocol: string): Promise<YieldSnapshot | null>;
  findHistorical(protocol: string, fromTime: string, toTime: string): Promise<YieldSnapshot[]>;
  
  // Bulk operations
  createBatch(snapshots: Omit<YieldSnapshot, 'id'>[]): Promise<YieldSnapshot[]>;
  deleteOldSnapshots(olderThan: string): Promise<number>;
  
  // Analytics
  getAverageAPY(protocol: string, asset: string, days: number): Promise<number | null>;
  getVolatilityScore(protocol: string, asset: string, days: number): Promise<number | null>;
}

/**
 * Block Repository Interface
 */
export interface BlockRepository extends BaseRepository<Block, string> {
  // Block-specific queries
  findLatestBlock(): Promise<Block | null>;
  findByHash(blockHash: string): Promise<Block | null>;
  findRange(fromBlock: string, toBlock: string): Promise<Block[]>;
  
  // Indexing operations
  setLastIndexedBlock(blockNumber: string): Promise<boolean>;
  getLastIndexedBlock(): Promise<string | null>;
  
  // Reorg detection
  findBlocksAfter(blockNumber: string): Promise<Block[]>;
  deleteBlocksAfter(blockNumber: string): Promise<number>;
  
  // Cleanup
  deleteOldBlocks(olderThan: string): Promise<number>;
}

/**
 * Database Transaction Interface
 */
export interface DatabaseTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
}

/**
 * Database Service Interface
 * 
 * Main database service that provides access to all repositories.
 */
export interface DatabaseService {
  // Repository access
  intents: IntentRepository;
  agents: AgentRepository;
  executions: ExecutionRepository;
  xcmMessages: XCMMessageRepository;
  yieldSnapshots: YieldSnapshotRepository;
  blocks: BlockRepository;
  
  // Transaction management
  beginTransaction(): Promise<DatabaseTransaction>;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Health checks
  ping(): Promise<boolean>;
  
  // Raw query access (for complex queries)
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
}

/**
 * Database Configuration Interface
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxRetries?: number;
}

/**
 * Migration Interface
 */
export interface Migration {
  id: string;
  name: string;
  up: (db: DatabaseService) => Promise<void>;
  down: (db: DatabaseService) => Promise<void>;
}

/**
 * Query Builder Interface
 */
export interface QueryBuilder<T> {
  select(fields?: (keyof T)[]): QueryBuilder<T>;
  where(field: keyof T, operator: string, value: any): QueryBuilder<T>;
  whereIn(field: keyof T, values: any[]): QueryBuilder<T>;
  orderBy(field: keyof T, direction?: 'ASC' | 'DESC'): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  offset(count: number): QueryBuilder<T>;
  join<U>(table: string, on: string): QueryBuilder<T & U>;
  leftJoin<U>(table: string, on: string): QueryBuilder<T & U>;
  groupBy(field: keyof T): QueryBuilder<T>;
  having(condition: string): QueryBuilder<T>;
  
  // Execution methods
  execute(): Promise<T[]>;
  first(): Promise<T | null>;
  count(): Promise<number>;
  exists(): Promise<boolean>;
  
  // Raw SQL
  raw(sql: string, params?: any[]): QueryBuilder<T>;
}

/**
 * Cache Interface for Database Results
 */
export interface DatabaseCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  
  // Pattern operations
  deletePattern(pattern: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

/**
 * Database Event Types
 */
export interface DatabaseEvent {
  type: 'insert' | 'update' | 'delete';
  table: string;
  id: string | number;
  data?: any;
  timestamp: number;
}

export interface DatabaseEventListener {
  onInsert?(event: DatabaseEvent): Promise<void>;
  onUpdate?(event: DatabaseEvent): Promise<void>;
  onDelete?(event: DatabaseEvent): Promise<void>;
}

/**
 * Database Metrics Interface
 */
export interface DatabaseMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  errorRate: number;
  uptime: number;
}