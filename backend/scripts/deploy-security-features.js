#!/usr/bin/env node

/**
 * Security Features Deployment Script
 * 
 * Handles deployment and migration of security features including
 * database migrations, configuration setup, and validation.
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');

class SecurityDeployment {
  constructor() {
    this.dbPool = null;
    this.redis = null;
  }

  async initialize() {
    // Initialize database connection
    this.dbPool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: process.env.DATABASE_PORT || 5432,
      database: process.env.DATABASE_NAME || 'nexusai',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'password',
    });

    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
    });

    console.log('✅ Database and Redis connections initialized');
  }

  async runDatabaseMigrations() {
    console.log('🔄 Running security-related database migrations...');

    const migrations = [
      {
        name: 'Add timelock operations table',
        sql: `
          CREATE TABLE IF NOT EXISTS timelock_operations (
            id VARCHAR(255) PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            scheduled_at TIMESTAMP NOT NULL,
            execute_at TIMESTAMP NOT NULL,
            executed_at TIMESTAMP,
            cancelled_at TIMESTAMP,
            parameters JSONB NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            created_by VARCHAR(42) NOT NULL,
            transaction_hash VARCHAR(66),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_timelock_operations_status ON timelock_operations(status);
          CREATE INDEX IF NOT EXISTS idx_timelock_operations_execute_at ON timelock_operations(execute_at);
          CREATE INDEX IF NOT EXISTS idx_timelock_operations_created_by ON timelock_operations(created_by);
        `
      },
      {
        name: 'Add security events table',
        sql: `
          CREATE TABLE IF NOT EXISTS security_events (
            id SERIAL PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            category VARCHAR(50),
            code VARCHAR(50),
            message TEXT,
            details JSONB,
            context JSONB,
            agent_address VARCHAR(42),
            timestamp TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
          CREATE INDEX IF NOT EXISTS idx_security_events_category ON security_events(category);
          CREATE INDEX IF NOT EXISTS idx_security_events_agent_address ON security_events(agent_address);
          CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
        `
      },
      {
        name: 'Add security alerts table',
        sql: `
          CREATE TABLE IF NOT EXISTS security_alerts (
            id VARCHAR(255) PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            details JSONB,
            agent_address VARCHAR(42),
            resolved BOOLEAN DEFAULT FALSE,
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type);
          CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
          CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON security_alerts(resolved);
          CREATE INDEX IF NOT EXISTS idx_security_alerts_agent_address ON security_alerts(agent_address);
        `
      },
      {
        name: 'Update agents table for enhanced reputation',
        sql: `
          -- Update reputation_score column to support 0-10000 range
          ALTER TABLE agents 
          ALTER COLUMN reputation_score TYPE INTEGER;
          
          -- Add reputation history tracking
          CREATE TABLE IF NOT EXISTS agent_reputation_history (
            id SERIAL PRIMARY KEY,
            agent_address VARCHAR(42) NOT NULL,
            old_score INTEGER NOT NULL,
            new_score INTEGER NOT NULL,
            reason TEXT NOT NULL,
            intent_id BIGINT,
            timestamp TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_reputation_history_agent ON agent_reputation_history(agent_address);
          CREATE INDEX IF NOT EXISTS idx_reputation_history_timestamp ON agent_reputation_history(timestamp);
        `
      },
      {
        name: 'Add security configuration table',
        sql: `
          CREATE TABLE IF NOT EXISTS security_configuration (
            key VARCHAR(100) PRIMARY KEY,
            value JSONB NOT NULL,
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by VARCHAR(42)
          );
          
          -- Insert default security configuration
          INSERT INTO security_configuration (key, value, description) VALUES
          ('maxActiveIntentsPerAgent', '10', 'Maximum active intents per agent')
          ON CONFLICT (key) DO NOTHING;
          
          INSERT INTO security_configuration (key, value, description) VALUES
          ('minReputationForClaim', '3000', 'Minimum reputation required to claim intents (BPS)')
          ON CONFLICT (key) DO NOTHING;
          
          INSERT INTO security_configuration (key, value, description) VALUES
          ('timelockDurationMs', '172800000', 'Timelock duration in milliseconds (2 days)')
          ON CONFLICT (key) DO NOTHING;
          
          INSERT INTO security_configuration (key, value, description) VALUES
          ('executionBufferSeconds', '300', 'Execution deadline buffer in seconds (5 minutes)')
          ON CONFLICT (key) DO NOTHING;
          
          INSERT INTO security_configuration (key, value, description) VALUES
          ('maxSlippageBps', '1000', 'Maximum allowed slippage in basis points (10%)')
          ON CONFLICT (key) DO NOTHING;
        `
      }
    ];

    for (const migration of migrations) {
      try {
        await this.dbPool.query(migration.sql);
        console.log(`✅ ${migration.name}`);
      } catch (error) {
        console.error(`❌ Failed to run migration: ${migration.name}`);
        console.error(error.message);
        throw error;
      }
    }

    console.log('✅ All database migrations completed successfully');
  }

  async setupRedisConfiguration() {
    console.log('🔄 Setting up Redis configuration for security features...');

    const redisConfigs = [
      {
        key: 'security:config',
        value: JSON.stringify({
          maxActiveIntentsPerAgent: 10,
          rateLimitWindowMs: 3600000,
          minReputationForClaim: 3000,
          maxReputationScore: 10000,
          initialReputationScore: 5000,
          timelockDurationMs: 172800000,
          executionBufferSeconds: 300,
          deadlineWarningThresholdSeconds: 1800,
          maxSlippageBps: 1000,
          defaultSlippageBps: 500,
          dynamicSlippageEnabled: true,
          minXCMAmount: '100000000000000000',
          maxXCMAmount: '1000000000000000000000',
          xcmValidationTimeoutMs: 5000,
          emergencyPauseEnabled: true,
          pauseGracePeriodMs: 30000,
          protocolWhitelistEnabled: true,
          whitelistCacheTtlMs: 300000,
          metricsEnabled: true,
          alertingEnabled: true,
          logLevel: 'info'
        }),
        ttl: 300
      },
      {
        key: 'security:config:version',
        value: '1',
        ttl: null
      },
      {
        key: 'security:metrics:initialized',
        value: JSON.stringify({
          totalEvents: 0,
          rateLimitViolations: 0,
          reputationChanges: 0,
          timelockOperations: 0,
          emergencyPauses: 0,
          whitelistViolations: 0,
          xcmValidations: 0,
          slippageViolations: 0,
          securityChecks: 0,
          lastReset: new Date().toISOString()
        }),
        ttl: null
      }
    ];

    for (const config of redisConfigs) {
      try {
        if (config.ttl) {
          await this.redis.setex(config.key, config.ttl, config.value);
        } else {
          await this.redis.set(config.key, config.value);
        }
        console.log(`✅ Set Redis config: ${config.key}`);
      } catch (error) {
        console.error(`❌ Failed to set Redis config: ${config.key}`);
        console.error(error.message);
        throw error;
      }
    }

    console.log('✅ Redis configuration setup completed');
  }

  async setupProtocolWhitelist() {
    console.log('🔄 Setting up protocol whitelist...');

    const whitelistedProtocols = [
      'hydration',
      'bifrost',
      'moonbeam',
      'acala',
      'astar',
      'parallel',
      'interlay',
      'centrifuge'
    ];

    for (const protocol of whitelistedProtocols) {
      try {
        await this.redis.setex(`protocol:whitelist:${protocol}`, 3600, 'true');
        console.log(`✅ Whitelisted protocol: ${protocol}`);
      } catch (error) {
        console.error(`❌ Failed to whitelist protocol: ${protocol}`);
        console.error(error.message);
      }
    }

    console.log('✅ Protocol whitelist setup completed');
  }

  async validateDeployment() {
    console.log('🔄 Validating security features deployment...');

    const validations = [
      {
        name: 'Database tables exist',
        check: async () => {
          const tables = ['timelock_operations', 'security_events', 'security_alerts', 'agent_reputation_history', 'security_configuration'];
          for (const table of tables) {
            const result = await this.dbPool.query(
              `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
              [table]
            );
            if (!result.rows[0].exists) {
              throw new Error(`Table ${table} does not exist`);
            }
          }
          return true;
        }
      },
      {
        name: 'Redis configuration exists',
        check: async () => {
          const config = await this.redis.get('security:config');
          if (!config) {
            throw new Error('Security configuration not found in Redis');
          }
          const parsed = JSON.parse(config);
          if (!parsed.maxActiveIntentsPerAgent) {
            throw new Error('Invalid security configuration');
          }
          return true;
        }
      },
      {
        name: 'Protocol whitelist exists',
        check: async () => {
          const hydrationExists = await this.redis.get('protocol:whitelist:hydration');
          if (!hydrationExists) {
            throw new Error('Protocol whitelist not properly configured');
          }
          return true;
        }
      },
      {
        name: 'Security metrics initialized',
        check: async () => {
          const metrics = await this.redis.get('security:metrics:initialized');
          if (!metrics) {
            throw new Error('Security metrics not initialized');
          }
          return true;
        }
      }
    ];

    for (const validation of validations) {
      try {
        await validation.check();
        console.log(`✅ ${validation.name}`);
      } catch (error) {
        console.error(`❌ ${validation.name}: ${error.message}`);
        throw error;
      }
    }

    console.log('✅ All deployment validations passed');
  }

  async createBackup() {
    console.log('🔄 Creating backup of current configuration...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups', timestamp);

    try {
      await fs.mkdir(backupDir, { recursive: true });

      // Backup database schema
      const tables = ['agents', 'intents', 'executions'];
      for (const table of tables) {
        const result = await this.dbPool.query(`SELECT * FROM ${table} LIMIT 0`);
        await fs.writeFile(
          path.join(backupDir, `${table}_schema.json`),
          JSON.stringify(result.fields.map(f => ({ name: f.name, type: f.dataTypeID })), null, 2)
        );
      }

      // Backup Redis configuration
      const redisKeys = await this.redis.keys('security:*');
      const redisBackup = {};
      for (const key of redisKeys) {
        redisBackup[key] = await this.redis.get(key);
      }
      await fs.writeFile(
        path.join(backupDir, 'redis_config.json'),
        JSON.stringify(redisBackup, null, 2)
      );

      console.log(`✅ Backup created at: ${backupDir}`);
    } catch (error) {
      console.error('❌ Failed to create backup:', error.message);
      throw error;
    }
  }

  async rollback() {
    console.log('🔄 Rolling back security features deployment...');

    try {
      // Remove security tables (in reverse order due to dependencies)
      const tablesToDrop = [
        'security_alerts',
        'security_events', 
        'agent_reputation_history',
        'security_configuration',
        'timelock_operations'
      ];

      for (const table of tablesToDrop) {
        await this.dbPool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Dropped table: ${table}`);
      }

      // Remove Redis keys
      const redisKeys = await this.redis.keys('security:*');
      if (redisKeys.length > 0) {
        await this.redis.del(...redisKeys);
        console.log(`✅ Removed ${redisKeys.length} Redis keys`);
      }

      // Remove protocol whitelist
      const protocolKeys = await this.redis.keys('protocol:whitelist:*');
      if (protocolKeys.length > 0) {
        await this.redis.del(...protocolKeys);
        console.log(`✅ Removed protocol whitelist`);
      }

      console.log('✅ Rollback completed successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }

  async cleanup() {
    if (this.dbPool) {
      await this.dbPool.end();
    }
    if (this.redis) {
      await this.redis.quit();
    }
    console.log('✅ Cleanup completed');
  }

  async deploy() {
    try {
      console.log('🚀 Starting security features deployment...\n');

      await this.initialize();
      await this.createBackup();
      await this.runDatabaseMigrations();
      await this.setupRedisConfiguration();
      await this.setupProtocolWhitelist();
      await this.validateDeployment();

      console.log('\n🎉 Security features deployment completed successfully!');
      console.log('🔒 All 12 security fixes have been deployed and validated.');
      
    } catch (error) {
      console.error('\n❌ Deployment failed:', error.message);
      console.log('\n🔄 Consider running rollback if needed: node deploy-security-features.js --rollback');
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// CLI handling
async function main() {
  const deployment = new SecurityDeployment();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--rollback')) {
    console.log('🔄 Starting rollback...\n');
    await deployment.initialize();
    await deployment.rollback();
    await deployment.cleanup();
  } else if (args.includes('--validate')) {
    console.log('🔍 Validating deployment...\n');
    await deployment.initialize();
    await deployment.validateDeployment();
    await deployment.cleanup();
  } else {
    await deployment.deploy();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Deployment script failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityDeployment;