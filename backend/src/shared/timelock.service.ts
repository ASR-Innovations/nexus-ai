import { Injectable, Logger } from '@nestjs/common';
import { DatabaseProvider } from './database.provider';
import { TimelockOperation, TimelockStatus } from './types/contract.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TimelockService {
  private readonly logger = new Logger(TimelockService.name);

  constructor(private databaseProvider: DatabaseProvider) {}

  async scheduleOperation(operation: Omit<TimelockOperation, 'id' | 'status' | 'createdBy'>): Promise<string> {
    const id = uuidv4();
    const executeAt = new Date(operation.scheduledAt.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days

    await this.databaseProvider.query(
      `INSERT INTO timelock_operations (id, type, scheduled_at, execute_at, parameters, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, operation.type, operation.scheduledAt, executeAt, JSON.stringify(operation.parameters), 'PENDING', 'system']
    );

    this.logger.log(`Scheduled timelock operation ${id} of type ${operation.type}`);
    return id;
  }

  async executeOperation(operationId: string): Promise<void> {
    const operation = await this.getOperation(operationId);
    if (!operation) {
      throw new Error(`Timelock operation ${operationId} not found`);
    }

    if (operation.status !== 'READY') {
      throw new Error(`Operation ${operationId} is not ready for execution (status: ${operation.status})`);
    }

    if (new Date() < operation.executeAt) {
      throw new Error(`Operation ${operationId} cannot be executed until ${operation.executeAt}`);
    }

    await this.databaseProvider.query(
      `UPDATE timelock_operations SET status = $1, executed_at = $2 WHERE id = $3`,
      ['EXECUTED', new Date(), operationId]
    );

    this.logger.log(`Executed timelock operation ${operationId}`);
  }

  async getOperation(operationId: string): Promise<TimelockOperation | null> {
    const result = await this.databaseProvider.query(
      'SELECT * FROM timelock_operations WHERE id = $1',
      [operationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      type: row.type,
      scheduledAt: row.scheduled_at,
      executeAt: row.execute_at,
      parameters: JSON.parse(row.parameters),
      status: row.status,
      createdBy: row.created_by
    };
  }

  async listPendingOperations(): Promise<TimelockOperation[]> {
    const result = await this.databaseProvider.query(
      'SELECT * FROM timelock_operations WHERE status = $1 ORDER BY scheduled_at ASC',
      ['PENDING']
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      scheduledAt: row.scheduled_at,
      executeAt: row.execute_at,
      parameters: JSON.parse(row.parameters),
      status: row.status,
      createdBy: row.created_by
    }));
  }

  async listReadyOperations(): Promise<TimelockOperation[]> {
    const now = new Date();
    
    // Update PENDING operations to READY if their time has come
    await this.databaseProvider.query(
      `UPDATE timelock_operations SET status = 'READY' 
       WHERE status = 'PENDING' AND execute_at <= $1`,
      [now]
    );

    const result = await this.databaseProvider.query(
      'SELECT * FROM timelock_operations WHERE status = $1 ORDER BY execute_at ASC',
      ['READY']
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      scheduledAt: row.scheduled_at,
      executeAt: row.execute_at,
      parameters: JSON.parse(row.parameters),
      status: row.status,
      createdBy: row.created_by
    }));
  }
}