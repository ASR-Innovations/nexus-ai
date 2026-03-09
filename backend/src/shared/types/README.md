# Database Types and Models

This directory contains TypeScript interfaces and types for the NexusAI Protocol database layer.

## Overview

The database layer is designed with the following principles:

1. **Type Safety**: All database operations are fully typed using TypeScript interfaces
2. **Repository Pattern**: Each table has a corresponding repository interface for data access
3. **Migration Support**: Database schema is managed through versioned migrations
4. **Performance**: Proper indexing and query optimization for high-throughput operations
5. **Consistency**: ACID transactions for critical operations

## File Structure

```
types/
├── database.types.ts          # Core database table interfaces and enums
├── api.types.ts              # API request/response types and business logic
├── database.service.types.ts # Repository interfaces and service contracts
├── index.ts                  # Central export point for all types
└── README.md                 # This file
```

## Database Tables

### Core Tables

#### `intents`
Stores user financial intents with guardrails and execution tracking.

**Key Features:**
- Guardrail columns for risk management (min_yield_bps, max_lock_duration, approved_protocols)
- Natural language goal storage for AI context
- Status tracking through intent lifecycle
- Indexed on user_address, status, created_at for performance

#### `agents`
Manages AI agents with staking, reputation, and performance metrics.

**Key Features:**
- Reputation scoring system (0-10000 basis points)
- Stake amount tracking for slashing mechanism
- Success/failure counters for performance metrics
- JSONB metadata storage for flexible agent profiles
- Indexed on reputation_score (DESC) for leaderboard queries

#### `executions`
Tracks execution instances for intents with step-by-step progress.

**Key Features:**
- Links to intents table via foreign key
- Step completion tracking (completed_steps/total_steps)
- Error message storage for debugging
- Timestamp tracking for performance analysis

#### `execution_steps`
Individual steps within an execution plan.

**Key Features:**
- Ordered steps with step_index
- Cross-chain support via destination_para_id (0 = local)
- Contract call data storage
- Transaction hash tracking for verification

#### `xcm_messages`
Cross-chain message tracking for XCM operations.

**Key Features:**
- XCM message hash and bytes storage
- Status tracking (DISPATCHED, CONFIRMED, FAILED)
- Parachain ID for destination tracking
- Confirmation timestamp for latency analysis

### Supporting Tables

#### `yield_snapshots`
Historical yield data for analysis and caching.

**Key Features:**
- Protocol and chain identification
- APY storage in basis points
- TVL tracking in USD
- Time-series data for volatility analysis
- Indexed on protocol+time and asset+time

#### `blocks`
Blockchain block tracking for event indexing and reorg detection.

**Key Features:**
- Block number and hash storage
- Indexing timestamp for performance monitoring
- Reorg detection support

## Type System

### Enums

```typescript
enum IntentStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  PLAN_SUBMITTED = 'PLAN_SUBMITTED',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}
```

### Core Interfaces

All database tables have corresponding TypeScript interfaces:

- `Intent` - User financial intents
- `Agent` - AI agent records
- `Execution` - Execution tracking
- `ExecutionStep` - Individual execution steps
- `XCMMessage` - Cross-chain messages
- `YieldSnapshot` - Historical yield data
- `Block` - Blockchain blocks

### Extended Types

- `IntentWithExecution` - Intent joined with execution data
- `AgentWithMetrics` - Agent with calculated performance metrics
- `ExecutionWithDetails` - Execution with steps and XCM messages
- `PaginatedResult<T>` - Generic pagination wrapper

## Repository Pattern

Each table has a corresponding repository interface:

```typescript
interface IntentRepository extends BaseRepository<Intent, string> {
  findByUserAddress(userAddress: string): Promise<PaginatedResult<Intent>>;
  findByStatus(status: IntentStatus): Promise<PaginatedResult<Intent>>;
  updateStatus(intentId: string, status: IntentStatus): Promise<boolean>;
  // ... other intent-specific methods
}
```

### Base Repository

All repositories extend `BaseRepository<T, K>` which provides:

- `findById(id: K): Promise<T | null>`
- `findMany(options?: QueryOptions): Promise<PaginatedResult<T>>`
- `create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>`
- `update(id: K, data: Partial<T>): Promise<T | null>`
- `delete(id: K): Promise<boolean>`
- `exists(id: K): Promise<boolean>`

## Usage Examples

### Basic CRUD Operations

```typescript
// Inject the database service
constructor(private readonly db: DatabaseServiceImpl) {}

// Find intent by ID
const intent = await this.db.intents.findById('123');

// Find intents by user
const userIntents = await this.db.intents.findByUserAddress('0x1234...', {
  limit: 10,
  offset: 0,
  orderBy: 'created_at',
  orderDirection: 'DESC'
});

// Update intent status
await this.db.intents.updateStatus('123', IntentStatus.COMPLETED);
```

### Complex Queries

```typescript
// Find intent with execution details
const intentWithExecution = await this.db.intents.findWithExecution('123');

// Find top agents by reputation
const topAgents = await this.db.agents.findTopAgentsByReputation(10);

// Find agent with performance metrics
const agentMetrics = await this.db.agents.findWithMetrics('0xagent...');
```

### Transactions

```typescript
const transaction = await this.db.beginTransaction();

try {
  // Update intent status
  await transaction.query(
    'UPDATE intents SET status = $1 WHERE id = $2',
    [IntentStatus.EXECUTING, intentId]
  );
  
  // Create execution record
  await transaction.query(
    'INSERT INTO executions (intent_id, status, total_steps, started_at) VALUES ($1, $2, $3, $4)',
    [intentId, ExecutionStatus.IN_PROGRESS, 3, Date.now().toString()]
  );
  
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

## Migration System

Database schema is managed through versioned migrations in the `backend/migrations/` directory.

### Migration Files

- `001_create_intents_table.js` - Intent table with guardrails
- `002_create_agents_table.js` - Agent registry with reputation
- `003_create_executions_table.js` - Execution tracking
- `004_create_execution_steps_table.js` - Step-by-step execution
- `005_create_xcm_messages_table.js` - Cross-chain message tracking
- `006_create_yield_snapshots_table.js` - Historical yield data
- `007_create_blocks_table.js` - Block indexing for events

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:check

# Set up database (alias for migrate)
npm run db:setup
```

## Performance Considerations

### Indexes

All tables include appropriate indexes for common query patterns:

- `intents`: user_address, status, assigned_agent, created_at
- `agents`: reputation_score (DESC), is_active
- `executions`: status, started_at
- `execution_steps`: intent_id, status, destination_para_id
- `xcm_messages`: intent_id, status, para_id, dispatched_at
- `yield_snapshots`: protocol+snapshot_at, asset+snapshot_at
- `blocks`: timestamp, indexed_at, block_hash

### Query Optimization

- Use pagination for large result sets
- Filter by indexed columns when possible
- Use appropriate JOIN strategies for related data
- Cache frequently accessed data in Redis

### Connection Pooling

The database provider uses connection pooling for optimal performance:

- Pool size configurable via environment variables
- Connection timeout and retry logic
- Health checks and automatic reconnection

## Type Guards

Runtime type checking is provided through type guard functions:

```typescript
if (isIntent(data)) {
  // TypeScript knows data is Intent type
  console.log(data.user_address);
}

if (isAgent(data)) {
  // TypeScript knows data is Agent type
  console.log(data.reputation_score);
}
```

## Constants

Centralized constants prevent typos and enable refactoring:

```typescript
import { TABLE_NAMES, INDEX_NAMES } from './types';

// Use constants instead of string literals
const query = `SELECT * FROM ${TABLE_NAMES.INTENTS} WHERE status = $1`;
```

## Error Handling

All database operations include proper error handling:

- Detailed logging for debugging
- Graceful degradation on connection failures
- Transaction rollback on errors
- Type-safe error responses

## Testing

Database types and repositories are designed for easy testing:

- Mock implementations for unit tests
- In-memory database for integration tests
- Type safety ensures test data validity
- Repository pattern enables dependency injection