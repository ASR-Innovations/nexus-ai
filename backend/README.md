# NexusAI Backend

Backend services for NexusAI Protocol with AI integration, cross-chain yield aggregation, and real-time execution tracking.

## Architecture

- **NestJS Framework**: Modular architecture with dependency injection
- **AI Integration**: DeepSeek for intent parsing and Mem0 for persistent memory
- **Cross-Chain**: Polkadot Hub EVM + parachain integration via @polkadot/api
- **Real-Time**: WebSocket connections for execution tracking
- **Caching**: Redis for performance optimization
- **Database**: PostgreSQL for persistent data storage

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Run migrations
   npm run migrate
   ```

4. **Development**
   ```bash
   npm run dev
   ```

## Module Structure

- **chat/**: Natural language processing with DeepSeek and Mem0
- **intent/**: Intent lifecycle management and transaction building
- **portfolio/**: Cross-chain balance aggregation
- **agents/**: Agent leaderboard and reputation tracking
- **yields/**: Real-time yield data aggregation from parachains
- **execution/**: Execution tracking and XCM monitoring
- **indexer/**: On-chain event indexing and database synchronization
- **websocket/**: Real-time updates for frontend
- **shared/**: Database, Redis, and contract providers

## API Endpoints

### Chat
- `POST /api/chat/message` - Process natural language intent

### Intent Management
- `POST /api/intent/create` - Create unsigned transaction for intent
- `POST /api/intent/approve` - Approve execution plan
- `POST /api/intent/execute` - Execute intent
- `GET /api/intent/:id` - Get intent details
- `GET /api/intent/user/:address` - Get user's intents

### Portfolio
- `GET /api/portfolio/:address` - Get cross-chain portfolio

### Agents
- `GET /api/agents` - Get agent leaderboard
- `GET /api/agents/:address` - Get agent details

### Yields
- `GET /api/yields/:asset` - Get yield options for asset

### Execution
- `GET /api/execution/:intentId` - Get execution details

## WebSocket Events

### Client → Server
- `subscribe` - Subscribe to intent updates
- `unsubscribe` - Unsubscribe from intent

### Server → Client
- `intent_update` - Intent status change
- `xcm_sent` - XCM message dispatched
- `execution_complete` - Execution completed
- `execution_failed` - Execution failed

## Background Jobs

- **Native Staking Refresh**: Every 60 seconds
- **Parachain Yields Refresh**: Every 120 seconds
- **Historical Snapshots**: Every 10 minutes
- **Event Indexing**: Real-time block processing
- **XCM Confirmation Polling**: Continuous monitoring

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## Production Deployment

```bash
# Build
npm run build

# Start production server
npm run start:prod
```

## Environment Variables

See `.env.example` for all required configuration variables.

## Dependencies

### Core NestJS
- @nestjs/common, @nestjs/core, @nestjs/platform-express
- @nestjs/websockets, @nestjs/platform-ws
- @nestjs/schedule, @nestjs/throttler, @nestjs/config

### Blockchain
- ethers (Polkadot Hub EVM interaction)
- @polkadot/api (Parachain interaction)

### Database & Cache
- pg (PostgreSQL client)
- ioredis (Redis client)
- node-pg-migrate (Database migrations)

### AI Services
- openai (DeepSeek API client)
- mem0ai (Persistent memory)

### Validation
- class-validator, class-transformer
- zod (Schema validation)