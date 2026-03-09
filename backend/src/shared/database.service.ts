/**
 * Database Service
 * 
 * Main database service that provides access to all repositories and manages connections.
 * Implements the DatabaseService interface with full type safety.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseProvider } from './database.provider';
import { BaseRepositoryImpl, DatabaseTransactionImpl } from './database.repository';
import {
  DatabaseService,
  IntentRepository,
  AgentRepository,
  ExecutionRepository,
  XCMMessageRepository,
  YieldSnapshotRepository,
  BlockRepository,
  DatabaseTransaction,
  DatabaseConfig,
} from './types/database.service.types';
import {
  Intent,
  Agent,
  Execution,
  DbExecutionStep,
  XCMMessage,
  YieldSnapshot,
  Block,
  IntentStatus,
  ExecutionStatus,
  XCMMessageStatus,
  TABLE_NAMES,
  IntentWithExecution,
  AgentWithMetrics,
  ExecutionWithDetails,
  PaginatedResult,
  QueryOptions,
} from './types';

/**
 * Intent Repository Implementation
 */
@Injectable()
class IntentRepositoryImpl extends BaseRepositoryImpl<Intent, string> implements IntentRepository {
  constructor(db: DatabaseProvider) {
    super(db, TABLE_NAMES.INTENTS, 'id');
  }

  async findByUserAddress(userAddress: string, options?: QueryOptions): Promise<PaginatedResult<Intent>> {
    return this.findMany({
      ...options,
      filters: { ...options?.filters, user_address: userAddress },
    });
  }

  async findByStatus(status: IntentStatus, options?: QueryOptions): Promise<PaginatedResult<Intent>> {
    return this.findMany({
      ...options,
      filters: { ...options?.filters, status },
    });
  }

  async findByAgent(agentAddress: string, options?: QueryOptions): Promise<PaginatedResult<Intent>> {
    return this.findMany({
      ...options,
      filters: { ...options?.filters, assigned_agent: agentAddress },
    });
  }

  async findWithExecution(intentId: string): Promise<IntentWithExecution | null> {
    const query = `
      SELECT 
        i.*,
        e.status as execution_status,
        e.total_steps,
        e.completed_steps,
        e.started_at as execution_started_at,
        e.completed_at as execution_completed_at,
        e.error_message,
        a.address as agent_address,
        a.reputation_score,
        a.metadata_json
      FROM ${TABLE_NAMES.INTENTS} i
      LEFT JOIN ${TABLE_NAMES.EXECUTIONS} e ON i.id = e.intent_id
      LEFT JOIN ${TABLE_NAMES.AGENTS} a ON i.assigned_agent = a.address
      WHERE i.id = $1
    `;

    const result = await this.queryOne(query, [intentId]);
    if (!result) return null;

    const intent: IntentWithExecution = {
      id: result.id,
      user_address: result.user_address,
      amount: result.amount,
      goal_hash: result.goal_hash,
      max_slippage_bps: result.max_slippage_bps,
      deadline: result.deadline,
      min_yield_bps: result.min_yield_bps,
      max_lock_duration: result.max_lock_duration,
      approved_protocols: result.approved_protocols,
      natural_language_goal: result.natural_language_goal,
      status: result.status,
      assigned_agent: result.assigned_agent,
      execution_plan_hash: result.execution_plan_hash,
      created_at: result.created_at,
      updated_at: result.updated_at,
    };

    if (result.execution_status) {
      intent.execution = {
        intent_id: result.id,
        status: result.execution_status,
        total_steps: result.total_steps,
        completed_steps: result.completed_steps,
        started_at: result.execution_started_at,
        completed_at: result.execution_completed_at,
        error_message: result.error_message,
      };
    }

    if (result.agent_address) {
      intent.agent = {
        address: result.agent_address,
        reputation_score: result.reputation_score,
        metadata_json: result.metadata_json,
      };
    }

    return intent;
  }

  async updateStatus(intentId: string, status: IntentStatus): Promise<boolean> {
    const result = await this.update(intentId, { status } as Partial<Intent>);
    return result !== null;
  }

  async assignAgent(intentId: string, agentAddress: string): Promise<boolean> {
    const result = await this.update(intentId, { 
      assigned_agent: agentAddress,
      status: IntentStatus.ASSIGNED,
    } as Partial<Intent>);
    return result !== null;
  }

  async setExecutionPlanHash(intentId: string, planHash: string): Promise<boolean> {
    const result = await this.update(intentId, { 
      execution_plan_hash: planHash,
      status: IntentStatus.PLAN_SUBMITTED,
    } as Partial<Intent>);
    return result !== null;
  }

  async findExpiredIntents(currentTimestamp: string): Promise<Intent[]> {
    const query = `
      SELECT * FROM ${TABLE_NAMES.INTENTS}
      WHERE deadline < $1 AND status IN ('PENDING', 'ASSIGNED', 'PLAN_SUBMITTED', 'APPROVED')
    `;
    return this.query(query, [currentTimestamp]);
  }

  async findPendingIntents(limit: number = 10): Promise<Intent[]> {
    const query = `
      SELECT * FROM ${TABLE_NAMES.INTENTS}
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT $1
    `;
    return this.query(query, [limit]);
  }
}

/**
 * Agent Repository Implementation
 */
@Injectable()
class AgentRepositoryImpl extends BaseRepositoryImpl<Agent, string> implements AgentRepository {
  constructor(db: DatabaseProvider) {
    super(db, TABLE_NAMES.AGENTS, 'address');
  }

  async findActiveAgents(options?: QueryOptions): Promise<PaginatedResult<Agent>> {
    return this.findMany({
      ...options,
      filters: { ...options?.filters, is_active: true },
    });
  }

  async findTopAgentsByReputation(limit: number): Promise<Agent[]> {
    const query = `
      SELECT * FROM ${TABLE_NAMES.AGENTS}
      WHERE is_active = true
      ORDER BY reputation_score DESC
      LIMIT $1
    `;
    return this.query(query, [limit]);
  }

  async findWithMetrics(agentAddress: string): Promise<AgentWithMetrics | null> {
    const agent = await this.findById(agentAddress);
    if (!agent) return null;

    const successRate = agent.total_executions > 0 
      ? (agent.success_count / agent.total_executions) * 100 
      : 0;

    // Calculate total volume handled
    const volumeQuery = `
      SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_volume
      FROM ${TABLE_NAMES.INTENTS}
      WHERE assigned_agent = $1 AND status = 'COMPLETED'
    `;
    const volumeResult = await this.queryOne(volumeQuery, [agentAddress]);

    return {
      ...agent,
      success_rate: successRate,
      total_volume_handled: volumeResult?.total_volume || '0',
    };
  }

  async updateReputation(agentAddress: string, newScore: number): Promise<boolean> {
    const result = await this.update(agentAddress, { 
      reputation_score: newScore 
    } as Partial<Agent>);
    return result !== null;
  }

  async updateStake(agentAddress: string, newStake: string): Promise<boolean> {
    const result = await this.update(agentAddress, { 
      stake_amount: newStake 
    } as Partial<Agent>);
    return result !== null;
  }

  async recordSuccess(agentAddress: string): Promise<boolean> {
    const query = `
      UPDATE ${TABLE_NAMES.AGENTS}
      SET 
        success_count = success_count + 1,
        total_executions = total_executions + 1,
        updated_at = $2
      WHERE address = $1
      RETURNING *
    `;
    const result = await this.query(query, [agentAddress, Date.now().toString()]);
    return result.length > 0;
  }

  async recordFailure(agentAddress: string, slashAmount: string): Promise<boolean> {
    const query = `
      UPDATE ${TABLE_NAMES.AGENTS}
      SET 
        fail_count = fail_count + 1,
        total_executions = total_executions + 1,
        stake_amount = CAST(stake_amount AS NUMERIC) - CAST($2 AS NUMERIC),
        updated_at = $3
      WHERE address = $1
      RETURNING *
    `;
    const result = await this.query(query, [agentAddress, slashAmount, Date.now().toString()]);
    return result.length > 0;
  }

  async activateAgent(agentAddress: string): Promise<boolean> {
    const result = await this.update(agentAddress, { 
      is_active: true 
    } as Partial<Agent>);
    return result !== null;
  }

  async deactivateAgent(agentAddress: string): Promise<boolean> {
    const result = await this.update(agentAddress, { 
      is_active: false 
    } as Partial<Agent>);
    return result !== null;
  }

  async updateMetadata(agentAddress: string, metadataJson: Record<string, any>): Promise<boolean> {
    const result = await this.update(agentAddress, { 
      metadata_json: metadataJson 
    } as Partial<Agent>);
    return result !== null;
  }
}

/**
 * Main Database Service Implementation
 */
@Injectable()
export class DatabaseServiceImpl implements /* DatabaseService, */ OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseServiceImpl.name);

  // Repository instances
  public readonly intents: IntentRepository;
  public readonly agents: AgentRepository;
  // public readonly executions: ExecutionRepository;
  // public readonly xcmMessages: XCMMessageRepository;
  // public readonly yieldSnapshots: YieldSnapshotRepository;
  // public readonly blocks: BlockRepository;

  constructor(
    private readonly databaseProvider: DatabaseProvider,
    private readonly configService: ConfigService,
  ) {
    // Initialize repositories
    this.intents = new IntentRepositoryImpl(databaseProvider);
    this.agents = new AgentRepositoryImpl(databaseProvider);
    // TODO: Initialize other repositories
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    try {
      // Test connection with a simple query
      await this.databaseProvider.healthCheck();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Use onModuleDestroy instead of disconnect
      await this.databaseProvider.onModuleDestroy();
      this.logger.log('Database disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect from database', error);
    }
  }

  isConnected(): boolean {
    // Use pool stats to check if connected
    const stats = this.databaseProvider.getPoolStats();
    return stats.totalCount > 0;
  }

  async ping(): Promise<boolean> {
    try {
      await this.databaseProvider.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database ping failed', error);
      return false;
    }
  }

  async beginTransaction(): Promise<DatabaseTransaction> {
    const client = await this.databaseProvider.getClient();
    await client.query('BEGIN');
    return new DatabaseTransactionImpl(this.databaseProvider, client);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.databaseProvider.query(sql, params);
    return result.rows;
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }
}

// TODO: Implement remaining repository classes
// - ExecutionRepositoryImpl
// - XCMMessageRepositoryImpl  
// - YieldSnapshotRepositoryImpl
// - BlockRepositoryImpl