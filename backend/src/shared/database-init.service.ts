import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MigrationService } from './migration.service';
import { DatabaseProvider } from './database.provider';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(
    private migrationService: MigrationService,
    private databaseProvider: DatabaseProvider,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.logger.log('Initializing database...');

      // Check database connection
      const isHealthy = await this.databaseProvider.healthCheck();
      if (!isHealthy) {
        throw new Error('Database connection failed');
      }

      // Run migrations if auto-migrate is enabled
      const autoMigrate = this.configService.get<boolean>('AUTO_MIGRATE', true);
      if (autoMigrate) {
        const status = await this.migrationService.checkMigrationStatus();
        
        if (!status.upToDate) {
          this.logger.log(`Running ${status.pendingCount} pending migrations...`);
          await this.migrationService.runMigrations();
        } else {
          this.logger.log('Database schema is up to date');
        }
      }

      this.logger.log('Database initialization completed');
    } catch (error) {
      this.logger.error('Database initialization failed', error);
      
      // In production, we might want to exit the process
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        process.exit(1);
      }
      
      throw error;
    }
  }

  /**
   * Manually trigger database initialization
   */
  async reinitialize(): Promise<void> {
    await this.initializeDatabase();
  }
}