import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseProvider } from './database.provider';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private databaseProvider: DatabaseProvider,
    private configService: ConfigService,
  ) {}

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();

      // Get list of migration files
      const migrationsDir = path.join(process.cwd(), 'migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .sort();

      // Get already applied migrations
      const appliedMigrations = await this.getAppliedMigrations();

      // Run pending migrations
      for (const file of migrationFiles) {
        const migrationName = path.basename(file, '.js');
        
        if (!appliedMigrations.includes(migrationName)) {
          await this.runMigration(file, migrationName);
        }
      }

      this.logger.log('All migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed', error);
      throw error;
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS pgmigrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        run_on TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    await this.databaseProvider.query(query);
  }

  private async getAppliedMigrations(): Promise<string[]> {
    try {
      const result = await this.databaseProvider.query(
        'SELECT name FROM pgmigrations ORDER BY id'
      );
      return result.rows.map((row: any) => row.name);
    } catch (error) {
      // If table doesn't exist, return empty array
      return [];
    }
  }

  private async runMigration(file: string, migrationName: string): Promise<void> {
    this.logger.log(`Running migration: ${migrationName}`);

    try {
      // Import migration file
      const migrationPath = path.join(process.cwd(), 'migrations', file);
      const migration = require(migrationPath);

      // Create pgm (node-pg-migrate) compatible object
      const pgm = this.createPgmObject();

      // Run the migration
      await migration.up(pgm);

      // Record migration as applied
      await this.databaseProvider.query(
        'INSERT INTO pgmigrations (name) VALUES ($1)',
        [migrationName]
      );

      this.logger.log(`Migration completed: ${migrationName}`);
    } catch (error) {
      this.logger.error(`Migration failed: ${migrationName}`, error);
      throw error;
    }
  }

  private createPgmObject() {
    return {
      createTable: async (tableName: string, columns: any, options?: any) => {
        const columnDefs = Object.entries(columns).map(([name, def]: [string, any]) => {
          let columnSql = `${name} ${this.getColumnType(def)}`;
          
          if (def.notNull) columnSql += ' NOT NULL';
          if (def.primaryKey) columnSql += ' PRIMARY KEY';
          if (def.default !== undefined) {
            columnSql += ` DEFAULT ${this.formatDefault(def.default)}`;
          }
          if (def.references) {
            columnSql += ` REFERENCES ${def.references}`;
            if (def.onDelete) columnSql += ` ON DELETE ${def.onDelete}`;
          }
          
          return columnSql;
        });

        const sql = `CREATE TABLE ${tableName} (${columnDefs.join(', ')})`;
        await this.databaseProvider.query(sql);
      },

      createIndex: async (tableName: string, columns: string | string[], options?: any) => {
        const columnList = Array.isArray(columns) ? columns.join(', ') : columns;
        const indexName = `idx_${tableName}_${Array.isArray(columns) ? columns.join('_') : columns}`;
        const orderClause = options?.order ? ` ${options.order}` : '';
        
        const sql = `CREATE INDEX ${indexName} ON ${tableName} (${columnList}${orderClause})`;
        await this.databaseProvider.query(sql);
      },

      addConstraint: async (tableName: string, constraintName: string, constraint: any) => {
        let constraintSql = '';
        
        if (constraint.unique) {
          const columns = Array.isArray(constraint.unique) 
            ? constraint.unique.join(', ') 
            : constraint.unique;
          constraintSql = `UNIQUE (${columns})`;
        }
        
        const sql = `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${constraintSql}`;
        await this.databaseProvider.query(sql);
      },

      dropTable: async (tableName: string) => {
        await this.databaseProvider.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      },
    };
  }

  private getColumnType(def: any): string {
    if (typeof def === 'string') return def;
    return def.type;
  }

  private formatDefault(value: any): string {
    if (typeof value === 'string') return `'${value}'`;
    if (typeof value === 'boolean') return value.toString();
    return value.toString();
  }

  /**
   * Check if migrations are up to date
   */
  async checkMigrationStatus(): Promise<{ upToDate: boolean; pendingCount: number }> {
    try {
      const migrationsDir = path.join(process.cwd(), 'migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'));

      const appliedMigrations = await this.getAppliedMigrations();
      const pendingCount = migrationFiles.length - appliedMigrations.length;

      return {
        upToDate: pendingCount === 0,
        pendingCount,
      };
    } catch (error) {
      this.logger.error('Failed to check migration status', error);
      return { upToDate: false, pendingCount: -1 };
    }
  }
}