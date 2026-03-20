# NexusAI Protocol

An autonomous DeFi platform built on Polkadot that enables AI-powered agents to execute complex cross-chain yield strategies with intelligent risk management and trustless execution.

## Overview

NexusAI Protocol combines artificial intelligence with decentralized finance to create a seamless experience for users seeking optimal yield opportunities across the Polkadot ecosystem. The platform uses autonomous agents that analyze market conditions, assess risks, and execute strategies across multiple parachains while maintaining security through on-chain guardrails and reputation systems.

## Architecture

The protocol consists of three main components:

### 1. Smart Contracts (Polkadot Hub EVM)
- **AgentRegistry**: Manages agent registration, staking, and reputation scoring
- **IntentVault**: Holds user deposits and enforces safety guardrails
- **ExecutionManager**: Builds and dispatches XCM messages for cross-chain execution

### 2. Backend Services (NestJS)
- AI-powered intent parsing using DeepSeek models
- Real-time strategy computation and risk assessment
- Portfolio tracking and transaction management
- WebSocket support for live updates
- Redis caching for performance optimization

### 3. Frontend Application (Next.js)
- Intuitive chat interface for natural language interactions
- Real-time portfolio dashboard with performance charts
- Agent marketplace and leaderboard
- Wallet integration with Polkadot.js
- Responsive design with dark mode support

## Key Features

### Autonomous AI Agents
- Agents stake tokens to participate in the network
- Reputation-based ranking system
- Automatic slashing for failed executions
- 24/7 strategy execution and monitoring

### Natural Language Interface
- Chat with AI to express financial goals
- Automatic intent parsing and strategy generation
- Risk assessment and explanation for each strategy
- Approval workflow for user control

### Cross-Chain Execution
- Seamless operation across Polkadot parachains
- XCM integration for trustless cross-chain transfers
- Support for Hydration, Bifrost, Moonbeam, and more
- Optimized gas costs and execution paths

### Security & Risk Management
- Multi-layer validation before execution
- On-chain guardrails (slippage limits, minimum deposits)
- Agent reputation and slashing mechanisms
- Comprehensive risk scoring using AI reasoning

## How It Works

### User Flow

1. **Connect Wallet**: Users connect their Polkadot wallet to the platform

2. **Express Intent**: Through natural language chat, users describe their goals
   ```
   "I want to earn yield on 100 DOT with medium risk tolerance"
   ```

3. **AI Processing**: The system:
   - Parses the intent using DeepSeek AI
   - Computes optimal strategies across multiple protocols
   - Assesses risks using DeepSeek Reasoner
   - Generates human-readable explanations

4. **Strategy Selection**: Users review and approve strategies with:
   - Estimated APY and net returns
   - Risk assessment and warnings
   - Protocol details and lock periods
   - Gas cost estimates

5. **Execution**: Upon approval:
   - Funds are deposited to IntentVault
   - Agent claims the intent and executes
   - XCM messages are dispatched cross-chain
   - Real-time updates via WebSocket

6. **Monitoring**: Users track:
   - Portfolio performance and yields
   - Transaction history
   - Agent execution status
   - Risk metrics and alerts

### Agent Flow

1. **Registration**: Agents stake minimum 10 DOT/PAS to register
2. **Intent Claiming**: Active agents claim intents from the vault
3. **Strategy Execution**: Agents execute approved strategies cross-chain
4. **Reputation Updates**: 
   - Success: Reputation increases, volume tracked
   - Failure: 10% stake slashed, reputation decreases
5. **Rewards**: Agents earn fees from successful executions

## Technical Stack

### Smart Contracts
- Solidity 0.8.19
- Hardhat for development and deployment
- OpenZeppelin contracts for security
- XCM precompile for cross-chain messaging

### Backend
- NestJS framework
- PostgreSQL database
- Redis for caching and rate limiting
- OpenAI SDK for DeepSeek integration
- Ethers.js for blockchain interaction
- Polkadot.js API for parachain queries

### Frontend
- Next.js 16 with React 19
- TypeScript for type safety
- Tailwind CSS for styling
- Framer Motion for animations
- Recharts for data visualization
- TanStack Query for data fetching

## Project Structure

```
polkadot_nexus/
├── contracts/          # Smart contracts
│   ├── contracts/      # Solidity source files
│   ├── deploy/         # Deployment scripts
│   ├── scripts/        # Utility scripts
│   └── typechain-types/# Generated TypeScript types
│
├── backend/            # Backend services
│   ├── src/
│   │   ├── agents/     # Agent management
│   │   ├── chat/       # AI chat service
│   │   ├── portfolio/  # Portfolio tracking
│   │   ├── strategy/   # Strategy computation
│   │   ├── execution/  # Execution management
│   │   └── shared/     # Shared utilities
│   ├── migrations/     # Database migrations
│   └── scripts/        # Setup scripts
│
└── frontend/           # Frontend application
    ├── src/
    │   ├── app/        # Next.js pages
    │   ├── components/ # React components
    │   ├── contexts/   # React contexts
    │   ├── hooks/      # Custom hooks
    │   ├── services/   # API services
    │   └── types/      # TypeScript types
    └── public/         # Static assets
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- A Polkadot wallet with testnet tokens

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/polkadot_nexus.git
cd polkadot_nexus
```

2. Install dependencies:
```bash
# Install all dependencies
npm install --prefix contracts
npm install --prefix backend
npm install --prefix frontend
```

3. Configure environment variables:
```bash
# Contracts
cp contracts/.env.example contracts/.env
# Edit contracts/.env with your private key

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with database, Redis, and API keys

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with API URLs
```

4. Deploy smart contracts:
```bash
cd contracts
npm run deploy:testnet
```

5. Setup database:
```bash
cd backend
npm run migrate
```

6. Start services:
```bash
# Backend (in one terminal)
cd backend
npm run dev

# Frontend (in another terminal)
cd frontend
npm run dev
```

7. Access the application at `http://localhost:3000`

## Network Configuration

### Testnet (Paseo)
- Chain ID: 420420417
- RPC: https://eth-rpc-testnet.polkadot.io/
- Explorer: https://blockscout-testnet.polkadot.io/
- Faucet: https://faucet.polkadot.io/

### Mainnet
- Chain ID: 420420419
- RPC: https://eth-rpc.polkadot.io/
- Explorer: https://blockscout.polkadot.io/

## Key Constants

### Smart Contracts
- MIN_DEPOSIT: 1 DOT/PAS
- MIN_STAKE: 10 DOT/PAS
- MAX_SLIPPAGE_BPS: 1000 (10%)
- PROTOCOL_FEE_BPS: 30 (0.3%)
- INITIAL_REPUTATION: 5000 (50%)
- SLASH_PERCENT: 10%

### Backend
- Rate Limit: 30 requests per 60 seconds
- Cache TTL: 60-300 seconds
- Strategy Computation Timeout: 5 seconds
- WebSocket Heartbeat: 30 seconds

## API Endpoints

### Chat
- `POST /chat/message` - Process user message and generate strategies
- `POST /chat/parse-intent` - Parse natural language intent

### Portfolio
- `GET /portfolio/balance/:address` - Get user balance
- `GET /portfolio/positions/:address` - Get active positions
- `GET /portfolio/history/:address` - Get transaction history

### Agents
- `GET /agents` - List all agents
- `GET /agents/:address` - Get agent details
- `GET /agents/leaderboard` - Get top agents by reputation

### Execution
- `POST /execution/submit` - Submit intent for execution
- `GET /execution/status/:intentId` - Get execution status

## Security Features

### Smart Contract Security
- ReentrancyGuard on all token transfers
- Pausable for emergency stops
- Timelock for critical parameter changes
- Agent authorization checks
- Slippage protection

### Backend Security
- Rate limiting per user
- Request deduplication
- Input validation with Zod schemas
- Helmet.js for HTTP headers
- CORS configuration

### Frontend Security
- Client-side validation
- Secure wallet integration
- Transaction simulation before signing
- User confirmation for all actions

## Testing

### Smart Contracts
```bash
cd contracts
npm test
```

### Backend
```bash
cd backend
npm test
```

### Frontend
```bash
cd frontend
npm test
```

## Deployment

### Smart Contracts
```bash
cd contracts
npm run deploy:mainnet
```

### Backend
```bash
cd backend
npm run build
npm run start:prod
```

### Frontend
```bash
cd frontend
npm run build
npm start
```

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests:
- GitHub Issues: [Create an issue](https://github.com/your-org/polkadot_nexus/issues)
- Documentation: [Read the docs](https://docs.nexusai.io)
- Discord: [Join our community](https://discord.gg/nexusai)

## Acknowledgments

Built for the Polkadot ecosystem with:
- Polkadot.js for blockchain interaction
- DeepSeek AI for intelligent intent parsing
- OpenZeppelin for secure smart contracts
- The amazing Polkadot community

---

**Note**: This project is in active development. Use testnet for experimentation and always review transactions before signing.
