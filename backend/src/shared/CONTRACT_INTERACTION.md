# Contract Interaction Layer

This document describes how to use the contract interaction layer for the NexusAI Protocol backend.

## Overview

The contract interaction layer provides TypeScript interfaces and services for interacting with the NexusAI Protocol smart contracts deployed on Polkadot Hub EVM. It includes:

- **TypeScript interfaces** generated from contract ABIs
- **ContractService** for reading contract state and building unsigned transactions
- **Type-safe contract interactions** with proper error handling
- **Gas estimation** and transaction building utilities

## Architecture

```
ContractService
├── Read Functions (view/pure contract calls)
├── Transaction Builders (create unsigned transactions)
├── Gas Estimation (estimate transaction costs)
└── Utility Functions (constants, addresses, etc.)
```

## Key Components

### 1. Contract Types (`contract.types.ts`)

Defines TypeScript interfaces for all contract structs, enums, and events:

```typescript
import { Intent, Agent, IntentStatus, UnsignedTransaction } from './types/contract.types';

// Example: Working with Intent struct
const intent: Intent = await contractService.getIntent(intentId);
console.log(`Intent status: ${IntentStatus[intent.status]}`);
```

### 2. Contract ABIs (`contract-abis.ts`)

Contains the complete ABIs for all three contracts:
- `COMPLETE_INTENT_VAULT_ABI`
- `COMPLETE_AGENT_REGISTRY_ABI` 
- `COMPLETE_EXECUTION_MANAGER_ABI`

### 3. ContractService (`contract.service.ts`)

Main service for contract interactions with three categories of methods:

#### Read Functions
```typescript
// Get intent details
const intent = await contractService.getIntent(intentId);

// Check agent status
const isActive = await contractService.isActiveAgent(agentAddress);

// Get execution details
const execution = await contractService.getExecution(intentId);
```

#### Transaction Builders
```typescript
// Build create intent transaction
const createTx = await contractService.buildCreateIntentTransaction({
  goalHash: '0x...',
  maxSlippageBps: 100,
  deadline: Math.floor(Date.now() / 1000) + 86400,
  minYieldBps: 500,
  maxLockDuration: 30 * 24 * 60 * 60,
  approvedProtocols: [],
  value: BigInt('1000000000000000000')
});

// Build agent registration transaction
const registerTx = await contractService.buildRegisterAgentTransaction({
  metadataURI: 'ipfs://...',
  value: BigInt('10000000000000000000') // 10 ETH stake
});
```

#### Gas Estimation
```typescript
// Estimate gas for operations
const gasEstimate = await contractService.estimateCreateIntentGas(params);
const gasPrice = await contractService.getGasPrice();
```

## Usage Examples

### 1. Reading Contract State

```typescript
import { Injectable } from '@nestjs/common';
import { ContractService } from '../shared/contract.service';

@Injectable()
export class IntentService {
  constructor(private contractService: ContractService) {}

  async getIntentDetails(intentId: string) {
    const id = BigInt(intentId);
    
    // Get intent from contract
    const intent = await this.contractService.getIntent(id);
    
    // Check if expired
    const isExpired = await this.contractService.isIntentExpired(id);
    
    return {
      ...intent,
      isExpired,
      // Convert BigInt to string for JSON serialization
      amount: intent.amount.toString(),
      deadline: intent.deadline.toString()
    };
  }
}
```

### 2. Building Transactions

```typescript
import { Injectable } from '@nestjs/common';
import { ContractService } from '../shared/contract.service';

@Injectable()
export class TransactionService {
  constructor(private contractService: ContractService) {}

  async createIntentTransaction(userParams: any) {
    // Validate parameters
    const minDeposit = await this.contractService.getMinDeposit();
    if (BigInt(userParams.amount) < minDeposit) {
      throw new Error('Amount below minimum deposit');
    }

    // Build unsigned transaction
    const unsignedTx = await this.contractService.buildCreateIntentTransaction({
      goalHash: userParams.goalHash,
      maxSlippageBps: userParams.maxSlippageBps,
      deadline: userParams.deadline,
      minYieldBps: userParams.minYieldBps,
      maxLockDuration: userParams.maxLockDuration,
      approvedProtocols: userParams.approvedProtocols,
      value: BigInt(userParams.amount)
    });

    return unsignedTx;
  }
}
```

### 3. Agent Management

```typescript
import { Injectable } from '@nestjs/common';
import { ContractService } from '../shared/contract.service';

@Injectable()
export class AgentService {
  constructor(private contractService: ContractService) {}

  async getAgentLeaderboard(limit: number = 10) {
    // Get top agents by reputation
    const topAgentAddresses = await this.contractService.getTopAgents(limit);
    
    // Fetch detailed info for each agent
    const agents = await Promise.all(
      topAgentAddresses.map(async (address) => {
        const agent = await this.contractService.getAgent(address);
        return {
          address,
          ...agent,
          // Convert BigInt fields to strings
          stakeAmount: agent.stakeAmount.toString(),
          reputationScore: agent.reputationScore.toString(),
          successCount: agent.successCount.toString(),
          failCount: agent.failCount.toString(),
          totalExecutions: agent.totalExecutions.toString()
        };
      })
    );

    return agents;
  }
}
```

## Configuration

Set the following environment variables:

```bash
# Polkadot Hub RPC URL
POLKADOT_HUB_RPC_URL=https://polkadot-asset-hub-rpc.polkadot.io

# Contract addresses (set after deployment)
INTENT_VAULT_ADDRESS=0x...
AGENT_REGISTRY_ADDRESS=0x...
EXECUTION_MANAGER_ADDRESS=0x...
```

## Error Handling

The ContractService includes comprehensive error handling:

```typescript
try {
  const intent = await contractService.getIntent(intentId);
  return intent;
} catch (error) {
  if (error.code === 'CALL_EXCEPTION') {
    // Contract call failed (e.g., intent doesn't exist)
    throw new NotFoundException('Intent not found');
  }
  // Handle other errors
  throw new InternalServerErrorException('Contract interaction failed');
}
```

## Gas Management

All transaction builders include automatic gas estimation with a 20% buffer:

```typescript
const gasLimit = await this.estimateGas(txParams);
// Add 20% buffer for safety
const finalGasLimit = gasLimit + gasLimit / BigInt(5);
```

## Type Safety

All contract interactions are fully typed:

```typescript
// TypeScript will enforce correct parameter types
const params: CreateIntentParams = {
  goalHash: string,      // Must be hex string
  maxSlippageBps: number, // Must be number
  deadline: number,       // Must be number
  minYieldBps: number,    // Must be number
  maxLockDuration: number, // Must be number
  approvedProtocols: string[], // Must be array of addresses
  value: bigint          // Must be BigInt
};
```

## Integration with Other Services

The ContractService is designed to be used by other backend services:

- **IntentService**: Create and manage intents
- **AgentService**: Agent registration and reputation
- **ExecutionService**: Track execution progress
- **IndexerService**: Listen to contract events
- **PortfolioService**: Query user positions

## Testing

Use the provided `ContractExampleService` to test contract interactions:

```typescript
import { ContractExampleService } from '../shared/contract-example.service';

// Test gas estimates
const estimates = await contractExampleService.getGasEstimates();

// Test contract configuration
const config = await contractExampleService.getContractConfiguration();

// Test agent eligibility
const eligibility = await contractExampleService.checkAgentEligibility(agentAddress);
```

## Migration from ContractProvider

The old `ContractProvider` is deprecated. Migrate to `ContractService`:

```typescript
// Old way (deprecated)
constructor(private contractProvider: ContractProvider) {}

// New way
constructor(private contractService: ContractService) {}
```

The `ContractProvider` is kept for backward compatibility but delegates to `ContractService`.