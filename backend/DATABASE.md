# Database Setup Guide

## Overview

NexusAI Protocol uses PostgreSQL as the primary database for storing intents, agents, executions, and other application data. The database schema is managed through migrations using a custom migration service.

## Prerequisites

- PostgreSQL 13+ installed and running
- Node.js 18+ with npm/yarn
- Environment variables configured (see `.env.example`)

## Database Schema

The database consists of the following tables:

### Core Tables

1. **intents** - User financial intents with guardrails
2. **agents** - AI agent registration and reputation data
3. **executions** - Execution tracking and status
4. **execution_steps** - Individual steps within executions
5. **xcm_messages** - Cross-chain message tracking
6. **yield_snapshots** - Historical yield data
7. **blocks** - Blockchain indexing state

### Indexes

Performance indexes are created for:
- `user_address` on intents table
- `status` on intents, executions, xcm_messages tables
- `reputation_score` on agents table (descending)
- `para_id` on xcm_messages table
- Time-based indexes for historical queries

## Setup Instructions

### 1. Database Creation

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database and user
CREATE DATABASE nexusai;
CREATE USER nexusai_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE nexusai TO nexusai_user;
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure database settings:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nexusai
DB_USER=nexusai_user
DB_PASSWORD=your_password
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

### 3. Run Migrations

```bash
# Install dependencies
npm install

# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:check

# Setup database (alias for migrate)
npm run db:setup
```

### 4. Verify Setup

```bash
# Start the application (will auto-run migrations if AUTO_MIGRATE=true)
npm run dev

# Check database connection in logs
# Should see: "Database initialization completed"
```

## Migration Management

### Creating New Migrations

1. Create a new file in `migrations/` directory:
   ```
   migrations/008_add_new_feature.js
   ```

2. Follow the migration format:
   ```javascript
   exports.up = (pgm) => {
     // Migration logic
     pgm.createTable('new_table', { ... });
   };

   exports.down = (pgm) => {
     // Rollback logic
     pgm.dropTable('new_table');
   };
   ```

### Migration Commands

```bash
# Run migrations manually
npm run migrate

# Check if migrations are needed
npm run migrate:check

# View migration status in application logs
npm run dev
```

## Connection Pool Configuration

The database uses connection pooling for optimal performance:

- **Min connections**: 2 (configurable via `DB_POOL_MIN`)
- **Max connections**: 20 (configurable via `DB_POOL_MAX`)
- **Idle timeout**: 30 seconds (configurable via `DB_IDLE_TIMEOUT`)
- **Connection timeout**: 2 seconds (configurable via `DB_CONNECTION_TIMEOUT`)

## Health Monitoring

The database provider includes health check functionality:

```typescript
// Check database health
const isHealthy = await databaseProvider.healthCheck();

// Get pool statistics
const stats = databaseProvider.getPoolStats();
console.log(`Active: ${stats.totalCount}, Idle: ${stats.idleCount}`);
```

## Production Considerations

### SSL Configuration

For production deployments, SSL is automatically enabled:

```env
NODE_ENV=production  # Enables SSL with rejectUnauthorized: false
```

### Auto-Migration

Set `AUTO_MIGRATE=false` in production to prevent automatic migrations:

```env
AUTO_MIGRATE=false
```

Then run migrations manually during deployment:

```bash
npm run migrate
```

### Backup Strategy

Implement regular backups:

```bash
# Create backup
pg_dump -U nexusai_user -h localhost nexusai > backup.sql

# Restore backup
psql -U nexusai_user -h localhost nexusai < backup.sql
```

## Troubleshooting

### Common Issues

1. **Connection refused**
   - Verify PostgreSQL is running
   - Check host/port configuration
   - Verify user permissions

2. **Migration failures**
   - Check database user permissions
   - Verify migration file syntax
   - Review application logs for details

3. **Pool exhaustion**
   - Increase `DB_POOL_MAX` if needed
   - Check for connection leaks in application code
   - Monitor pool statistics

### Debug Mode

Enable detailed logging in development:

```env
NODE_ENV=development  # Enables query logging and pool events
```

## Schema Documentation

For detailed schema documentation, see:
- `migrations/` directory for table definitions
- `src/shared/database.provider.ts` for connection logic
- Design document for entity relationships