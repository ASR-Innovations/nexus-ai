#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MigrationService } from '../src/shared/migration.service';
import { Logger } from '@nestjs/common';

async function runMigrations() {
  const logger = new Logger('Migration');
  
  try {
    logger.log('Starting migration process...');
    
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get migration service
    const migrationService = app.get(MigrationService);
    
    // Check migration status
    const status = await migrationService.checkMigrationStatus();
    logger.log(`Migration status: ${status.upToDate ? 'Up to date' : `${status.pendingCount} pending`}`);
    
    if (!status.upToDate) {
      // Run migrations
      await migrationService.runMigrations();
      logger.log('All migrations completed successfully');
    } else {
      logger.log('No migrations to run');
    }
    
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Export function for checking status
export async function checkStatus() {
  const logger = new Logger('Migration Check');
  
  try {
    logger.log('Checking migration status...');
    
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get migration service
    const migrationService = app.get(MigrationService);
    
    // Check migration status
    const status = await migrationService.checkMigrationStatus();
    logger.log(`Migration status: ${status.upToDate ? 'Up to date' : `${status.pendingCount} pending`}`);
    
    await app.close();
    return status;
  } catch (error) {
    logger.error('Migration check failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}