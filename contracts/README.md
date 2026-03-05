# NexusAI Protocol Smart Contracts

Smart contracts for the NexusAI Protocol on Polkadot Hub EVM, enabling cross-chain AI intent resolution with trustless execution and agent reputation management.

## Architecture

The protocol consists of three main smart contracts:

1. **AgentRegistry**: Manages AI agent registration, staking, and reputation scoring
2. **IntentVault**: Holds user deposits, enforces guardrails, and manages intent lifecycle
3. **ExecutionManager**: Builds and dispatches XCM messages for cross-chain execution

## Prerequisites

- Node.js 18+ and npm
- A wallet with PAS (testnet) or DOT (mainnet) for deployment
- Environment variables configured (see `.env.example`)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy and configure environment variables:
```bash
cp .env.example .env
# Edit .env with your private key and RPC URLs
```

3. Compile contracts:
```bash
npm run compile
```

## Deployment

### Local Development
```bash
# Start local Hardhat network
npm run node

# Deploy to local network (in another terminal)
npm run deploy:local
```

### Polkadot Hub Testnet
```bash
# Deploy to testnet
npm run deploy:testnet
```

### Polkadot Hub Mainnet
```bash
# Deploy to mainnet (with safety checks)
npm run deploy:mainnet
```

## Deployment Scripts

The deployment uses hardhat-deploy for deterministic deployments:

1. **001_deploy_agent_registry.ts**: Deploys AgentRegistry (no dependencies)
2. **003_deploy_intent_vault.ts**: Deploys IntentVault with AgentRegistry and placeholder ExecutionManager
3. **002_deploy_execution_manager.ts**: Deploys ExecutionManager with IntentVault address and updates IntentVault
4. **004_complete_setup.ts**: Verifies all connections and displays deployment summary

## Contract Addresses

After deployment, contract addresses will be displayed and saved for backend/frontend configuration.

### Testnet Addresses
- Chain ID: 420420417
- RPC URL: https://eth-rpc-testnet.polkadot.io/
- Block Explorer: https://blockscout-testnet.polkadot.io/
- Faucet: https://faucet.polkadot.io/
- AgentRegistry: `TBD`
- IntentVault: `TBD`
- ExecutionManager: `TBD`

### Mainnet Addresses
- Chain ID: 420420419
- RPC URL: https://eth-rpc.polkadot.io/
- Block Explorer: https://blockscout.polkadot.io/
- AgentRegistry: `TBD`
- IntentVault: `TBD`
- ExecutionManager: `TBD`

## Key Constants

- MIN_DEPOSIT: 1 DOT/PAS
- MIN_STAKE: 10 DOT/PAS
- MAX_SLIPPAGE_BPS: 1000 (10%)
- PROTOCOL_FEE_BPS: 30 (0.3%)
- INITIAL_REPUTATION: 5000 (50%)
- SLASH_PERCENT: 10%

## XCM Integration

The ExecutionManager uses the XCM precompile at address `0x0000000000000000000000000000000000000a00` to dispatch cross-chain messages to:

- Hydration (paraId: 2034)
- Bifrost (paraId: 2030)  
- Moonbeam (paraId: 2004)

## Verification

Contracts are automatically verified on the block explorer during deployment. Manual verification:

```bash
npx hardhat verify --network polkadotHubTestnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Testing

```bash
# Run all tests
npm test

# Run tests with gas reporting
REPORT_GAS=true npm test
```

## Security Features

- ReentrancyGuard on all token transfer functions
- Agent authorization checks
- On-chain guardrails for user protection
- Slashing mechanism for agent accountability

## Integration

After deployment, update your backend and frontend with the contract addresses:

1. Update backend environment variables
2. Update frontend contract configuration
3. Test contract interactions
4. Register test agents for development

## Support

For issues or questions:
- Check the deployment logs for error details
- Verify your wallet has sufficient balance
- Ensure you're connected to the correct network
- Review the contract verification status on the block explorer