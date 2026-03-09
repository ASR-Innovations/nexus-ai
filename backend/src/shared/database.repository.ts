/**
 * Database Repository Base Class
 * 
 * Base implementation for database repositories with common CRUD operations.
 * Provides type-safe database access patterns for all entities.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseProvider } from './database.provider';
import {
  BaseRepository,
  DatabaseTransaction,
  QueryBuilder,
} from './types/database.service.types';
import { QueryOptions, PaginatedResult } from './types/database.types';

/**
 * Abstract Base Repository
 * 
 * Provides common database operations that can be extended by specific repositories.
 */
@Injectable()
export abstract class BaseRepositoryImpl<T, K = string> implements BaseRepository<T, K> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly db: DatabaseProvider,
    protected readonly tableName: string,
    protected readonly primaryKey: string = 'id',
  ) {}

  /**
   * Find entity by primary key
   */
  async findById(id: K): Promise<T | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
      const result = await this.db.query(query, [id]);
      
      return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      this.logger.error(`Failed to find ${this.tableName} by id ${id}`, error);
      throw error;
    }
  }

  /**
   * Find multiple entities with pagination and filtering
   */
  async findMany(options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    try {
      const {
        limit = 20,
        offset = 0,
        orderBy = this.primaryKey,
        orderDirection = 'DESC',
        filters = {},
      } = options;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      Object.entries(filters).forEach(([field, value]) => {
        if (value !== undefined && value !== null) {
          whereConditions.push(`${field} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      });

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Count query
      const countQuery = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`;
      const countResult = await this.db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Data query
      const dataQuery = `
        SELECT * FROM ${this.tableName} 
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const dataResult = await this.db.query(dataQuery, [...params, limit, offset]);
      const data = dataResult.rows.map((row: any) => this.mapRow(row));

      return {
        data,
        total,
        offset,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to find many ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Create new entity
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    try {
      const now = Date.now().toString();
      const entityData = {
        ...data,
        created_at: now,
        updated_at: now,
      };

      const fields = Object.keys(entityData);
      const values = Object.values(entityData);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

      const query = `
        INSERT INTO ${this.tableName} (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.db.query(query, values);
      return this.mapRow(result.rows[0]);
    } catch (error) {
      this.logger.error(`Failed to create ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Update entity by primary key
   */
  async update(id: K, data: Partial<T>): Promise<T | null> {
    try {
      const updateData = {
        ...data,
        updated_at: Date.now().toString(),
      };

      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      
      if (fields.length === 0) {
        return this.findById(id);
      }

      const setClause = fields
        .map((field, index) => `${field} = $${index + 1}`)
        .join(', ');

      const query = `
        UPDATE ${this.tableName} 
        SET ${setClause}
        WHERE ${this.primaryKey} = $${fields.length + 1}
        RETURNING *
      `;

      const result = await this.db.query(query, [...values, id]);
      return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      this.logger.error(`Failed to update ${this.tableName} with id ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete entity by primary key
   */
  async delete(id: K): Promise<boolean> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
      const result = await this.db.query(query, [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete ${this.tableName} with id ${id}`, error);
      throw error;
    }
  }

  /**
   * Check if entity exists by primary key
   */
  async exists(id: K): Promise<boolean> {
    try {
      const query = `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = $1 LIMIT 1`;
      const result = await this.db.query(query, [id]);
      
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error(`Failed to check existence of ${this.tableName} with id ${id}`, error);
      throw error;
    }
  }

  /**
   * Execute raw query with parameters
   */
  protected async query<R = any>(sql: string, params: any[] = []): Promise<R[]> {
    try {
      const result = await this.db.query(sql, params);
      return result.rows;
    } catch (error) {
      this.logger.error(`Query failed: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Execute raw query and return single result
   */
  protected async queryOne<R = any>(sql: string, params: any[] = []): Promise<R | null> {
    const results = await this.query<R>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Begin database transaction
   */
  protected async beginTransaction(): Promise<DatabaseTransaction> {
    // Use the provider's transaction method instead
    const client = await this.db.getClient();
    await client.query('BEGIN');
    return new DatabaseTransactionImpl(this.db, client);
  }

  /**
   * Map database row to entity type
   * Override this method in subclasses for custom mapping
   */
  protected mapRow(row: any): T {
    return row as T;
  }

  /**
   * Build complex queries with fluent interface
   */
  protected createQueryBuilder(): QueryBuilder<T> {
    return new QueryBuilderImpl<T>(this.db, this.tableName);
  }
}

/**
 * Query Builder Implementation
 * 
 * Provides fluent interface for building complex SQL queries.
 */
class QueryBuilderImpl<T> implements QueryBuilder<T> {
  private selectFields: string[] = ['*'];
  private whereConditions: string[] = [];
  private joinClauses: string[] = [];
  private orderByClause: string = '';
  private limitClause: string = '';
  private offsetClause: string = '';
  private groupByClause: string = '';
  private havingClause: string = '';
  private params: any[] = [];
  private paramIndex: number = 1;

  constructor(
    private readonly db: DatabaseProvider,
    private readonly tableName: string,
  ) {}

  select(fields?: (keyof T)[]): QueryBuilder<T> {
    if (fields && fields.length > 0) {
      this.selectFields = fields.map(f => String(f));
    }
    return this;
  }

  where(field: keyof T, operator: string, value: any): QueryBuilder<T> {
    this.whereConditions.push(`${String(field)} ${operator} $${this.paramIndex}`);
    this.params.push(value);
    this.paramIndex++;
    return this;
  }

  whereIn(field: keyof T, values: any[]): QueryBuilder<T> {
    if (values.length === 0) return this;
    
    const placeholders = values.map(() => `$${this.paramIndex++}`).join(', ');
    this.whereConditions.push(`${String(field)} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  orderBy(field: keyof T, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder<T> {
    this.orderByClause = `ORDER BY ${String(field)} ${direction}`;
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.limitClause = `LIMIT ${count}`;
    return this;
  }

  offset(count: number): QueryBuilder<T> {
    this.offsetClause = `OFFSET ${count}`;
    return this;
  }

  join<U>(table: string, on: string): QueryBuilder<T & U> {
    this.joinClauses.push(`JOIN ${table} ON ${on}`);
    return this as any;
  }

  leftJoin<U>(table: string, on: string): QueryBuilder<T & U> {
    this.joinClauses.push(`LEFT JOIN ${table} ON ${on}`);
    return this as any;
  }

  groupBy(field: keyof T): QueryBuilder<T> {
    this.groupByClause = `GROUP BY ${String(field)}`;
    return this;
  }

  having(condition: string): QueryBuilder<T> {
    this.havingClause = `HAVING ${condition}`;
    return this;
  }

  raw(sql: string, params: any[] = []): QueryBuilder<T> {
    // For raw SQL, we replace the entire query
    this.selectFields = [sql];
    this.params = params;
    return this;
  }

  private buildQuery(): string {
    const parts = [
      `SELECT ${this.selectFields.join(', ')}`,
      `FROM ${this.tableName}`,
      ...this.joinClauses,
    ];

    if (this.whereConditions.length > 0) {
      parts.push(`WHERE ${this.whereConditions.join(' AND ')}`);
    }

    if (this.groupByClause) {
      parts.push(this.groupByClause);
    }

    if (this.havingClause) {
      parts.push(this.havingClause);
    }

    if (this.orderByClause) {
      parts.push(this.orderByClause);
    }

    if (this.limitClause) {
      parts.push(this.limitClause);
    }

    if (this.offsetClause) {
      parts.push(this.offsetClause);
    }

    return parts.join(' ');
  }

  async execute(): Promise<T[]> {
    const query = this.buildQuery();
    const result = await this.db.query(query, this.params);
    return result.rows;
  }

  async first(): Promise<T | null> {
    this.limit(1);
    const results = await this.execute();
    return results.length > 0 ? results[0] : null;
  }

  async count(): Promise<number> {
    const countQuery = this.buildQuery().replace(
      `SELECT ${this.selectFields.join(', ')}`,
      'SELECT COUNT(*)'
    );
    const result = await this.db.query(countQuery, this.params);
    return parseInt(result.rows[0].count);
  }

  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }
}

/**
 * Database Transaction Implementation
 */
export class DatabaseTransactionImpl implements DatabaseTransaction {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly client: any, // pg Client
  ) {}

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
    this.client.release();
  }

  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
    this.client.release();
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.client.query(sql, params);
    return result.rows;
  }
}