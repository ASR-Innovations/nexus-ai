/**
 * Timelock Repository Implementation
 * 
 * Database operations for timelock management using PostgreSQL.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseProvider } from '../database.provider';
import {
  TimelockOperation,
  TimelockOperationType,
  TimelockStatus,
  CreateTimelockOperationParams,
  TimelockRepository,
  TIMELOCK_CONSTANTS
} from '../types/timelock.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TimelockRepositoryImpl implements TimelockRepository {
  private readonly logger = new Logger(TimelockRepositoryImpl.name);

  constructor(private readonly databaseProvider: DatabaseProvider) {}

  /**
   * Find timelock operation by ID
   */
  async findById(id: string): Promise<TimelockOperation | null> {
    try {
      const result = await this.databaseProvider.query(
        'SELECT * FROM timelock_operations WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToOperation(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to find timelock operation ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new timelock operation
   */
  async create(data: CreateTimelockOperationParams): Promise<TimelockOperation> {
    try {
      const id = uuidv4();
      const now = new Date();
      const delayMs = (data.delayDays || TIMELOCK_CONSTANTS.DEFAULT_DELAY_DAYS) * 24 * 60 * 60 * 1000;
      const executeAt = new Date(now.getTime() + delayMs);

      const result = await this.databaseProvider.query(
        `INSERT INTO timelock_operations 
         (id, type, scheduled_at, execute_at, parameters, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          data.type,
          now,
          executeAt,
          JSON.stringify(data.parameters),
          TimelockStatus.PENDING,
          data.createdBy,
          now,
          now
        ]
      );

      return this.mapRowToOperation(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to create timelock operation:', error);
      throw error;
    }
  }

  /**
   * Update timelock operation
   */
  async update(id: string, data: Partial<TimelockOperation>): Promise<TimelockOperation | null> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'id' && value !== undefined) {
          updateFields.push(`${this.camelToSnake(key)} = $${paramIndex}`);
          values.push(key === 'parameters' ? JSON.stringify(value) : value);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return await this.findById(id);
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      values.push(id); // WHERE clause parameter

      const query = `
        UPDATE timelock_operations 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await this.databaseProvider.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToOperation(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to update timelock operation ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete timelock operation
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.databaseProvider.query(
        'DELETE FROM timelock_operations WHERE id = $1',
        [id]
      );

      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete timelock operation ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find operations by status
   */
  async findByStatus(status: TimelockStatus): Promise<TimelockOperation[]> {
    try {
      const result = await this.databaseProvider.query(
        'SELECT * FROM timelock_operations WHERE status = $1 ORDER BY scheduled_at ASC',
        [status]
      );

      return result.rows.map((row: any) => this.mapRowToOperation(row));
    } catch (error) {
      this.logger.error(`Failed to find operations by status ${status}:`, error);
      throw error;
    }
  }

  /**
   * Find pending operations
   */
  async findPendingOperations(): Promise<TimelockOperation[]> {
    return this.findByStatus(TimelockStatus.PENDING);
  }

  /**
   * Find operations ready for execution
   */
  async findReadyOperations(): Promise<TimelockOperation[]> {
    try {
      // First update PENDING operations to READY if their time has come
      await this.databaseProvider.query(
        `UPDATE timelock_operations 
         SET status = $1, updated_at = $2
         WHERE status = $3 AND execute_at <= $4`,
        [TimelockStatus.READY, new Date(), TimelockStatus.PENDING, new Date()]
      );

      // Then return all READY operations
      return this.findByStatus(TimelockStatus.READY);
    } catch (error) {
      this.logger.error('Failed to find ready operations:', error);
      throw error;
    }
  }

  /**
   * Find operations by type
   */
  async findByType(type: TimelockOperationType): Promise<TimelockOperation[]> {
    try {
      const result = await this.databaseProvider.query(
        'SELECT * FROM timelock_operations WHERE type = $1 ORDER BY scheduled_at ASC',
        [type]
      );

      return result.rows.map((row: any) => this.mapRowToOperation(row));
    } catch (error) {
      this.logger.error(`Failed to find operations by type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Update operation status
   */
  async updateStatus(id: string, status: TimelockStatus): Promise<boolean> {
    try {
      const result = await this.databaseProvider.query(
        'UPDATE timelock_operations SET status = $1, updated_at = $2 WHERE id = $3',
        [status, new Date(), id]
      );

      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Failed to update status for operation ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mark operation as executed
   */
  async setExecuted(id: string, transactionHash: string): Promise<boolean> {
    try {
      const now = new Date();
      const result = await this.databaseProvider.query(
        `UPDATE timelock_operations 
         SET status = $1, executed_at = $2, transaction_hash = $3, updated_at = $4
         WHERE id = $5`,
        [TimelockStatus.EXECUTED, now, transactionHash, now, id]
      );

      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Failed to set operation ${id} as executed:`, error);
      throw error;
    }
  }

  /**
   * Mark operation as cancelled
   */
  async setCancelled(id: string): Promise<boolean> {
    try {
      const now = new Date();
      const result = await this.databaseProvider.query(
        `UPDATE timelock_operations 
         SET status = $1, cancelled_at = $2, updated_at = $3
         WHERE id = $4`,
        [TimelockStatus.CANCELLED, now, now, id]
      );

      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Failed to set operation ${id} as cancelled:`, error);
      throw error;
    }
  }

  /**
   * Mark operation as failed
   */
  async setFailed(id: string, errorMessage: string): Promise<boolean> {
    try {
      const now = new Date();
      const result = await this.databaseProvider.query(
        `UPDATE timelock_operations 
         SET status = $1, error_message = $2, updated_at = $3
         WHERE id = $4`,
        [TimelockStatus.FAILED, errorMessage, now, id]
      );

      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Failed to set operation ${id} as failed:`, error);
      throw error;
    }
  }

  /**
   * Delete old operations
   */
  async deleteOldOperations(olderThan: Date): Promise<number> {
    try {
      const result = await this.databaseProvider.query(
        `DELETE FROM timelock_operations 
         WHERE status IN ($1, $2, $3) AND updated_at < $4`,
        [TimelockStatus.EXECUTED, TimelockStatus.CANCELLED, TimelockStatus.FAILED, olderThan]
      );

      return result.rowCount || 0;
    } catch (error) {
      this.logger.error('Failed to delete old operations:', error);
      throw error;
    }
  }

  /**
   * Map database row to TimelockOperation object
   */
  private mapRowToOperation(row: any): TimelockOperation {
    return {
      id: row.id,
      type: row.type as TimelockOperationType,
      scheduledAt: new Date(row.scheduled_at),
      executeAt: new Date(row.execute_at),
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
      status: row.status as TimelockStatus,
      createdBy: row.created_by,
      transactionHash: row.transaction_hash,
      errorMessage: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Convert camelCase to snake_case for database columns
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}