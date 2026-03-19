/**
 * Property-based testing utilities for protocol execution system
 * Uses fast-check library for comprehensive randomized testing
 */

import fc from 'fast-check';
import { ethers } from 'ethers';

// ============================================================================
// Address and Hash Generators
// ============================================================================

export const ethereumAddressArbitrary = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 40, maxLength: 40 })
    .filter(s => /^[0-9a-fA-F]+$/.test(s))
    .map((hex: string) => `0x${hex}`);

export const polkadotAddressArbitrary = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 47, maxLength: 48 })
    .filter(addr => addr.length === 47 || addr.length === 48);

export const transactionHashArbitrary = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 64, maxLength: 64 })
    .filter(s => /^[0-9a-fA-F]+$/.test(s))
    .map((hex: string) => `0x${hex}`);

// ============================================================================
// Token and Amount Generators
// ============================================================================

export const tokenSymbolArbitrary = (): fc.Arbitrary<string> =>
  fc.constantFrom('DOT', 'KSM', 'GLMR', 'USDT', 'USDC', 'HDX', 'vDOT', 'vKSM', 'STELLA', 'BEAM');

export const tokenAmountArbitrary = (): fc.Arbitrary<string> =>
  fc.bigInt({ min: 1n, max: 1000000000000000000000n }) // 1 wei to 1000 tokens
    .map(amount => amount.toString());

export const weiAmountArbitrary = (): fc.Arbitrary<string> =>
  fc.bigInt({ min: 1n, max: ethers.parseEther('1000000') }) // 1 wei to 1M ETH
    .map(amount => amount.toString());

export const percentageArbitrary = (): fc.Arbitrary<number> =>
  fc.float({ min: 0, max: 100, noNaN: true });

export const slippageArbitrary = (): fc.Arbitrary<number> =>
  fc.float({ min: 0.01, max: 10, noNaN: true }); // 0.01% to 10%

// ============================================================================
// Protocol Parameter Generators
// ============================================================================

export const hydrationSwapParamsArbitrary = () =>
  fc.record({
    tokenIn: tokenSymbolArbitrary(),
    tokenOut: tokenSymbolArbitrary(),
    amountIn: tokenAmountArbitrary(),
    minAmountOut: tokenAmountArbitrary(),
    recipient: ethereumAddressArbitrary(),
    deadline: fc.integer({ min: Math.floor(Date.now() / 1000) + 300, max: Math.floor(Date.now() / 1000) + 86400 })
  }).filter(params => params.tokenIn !== params.tokenOut);

export const bifrostMintParamsArbitrary = () =>
  fc.record({
    asset: fc.constantFrom('DOT', 'KSM', 'GLMR'),
    amount: tokenAmountArbitrary(),
    recipient: ethereumAddressArbitrary()
  });

export const dexSwapParamsArbitrary = () =>
  fc.record({
    tokenIn: tokenSymbolArbitrary(),
    tokenOut: tokenSymbolArbitrary(),
    amountIn: tokenAmountArbitrary(),
    minAmountOut: tokenAmountArbitrary(),
    path: fc.array(tokenSymbolArbitrary(), { minLength: 2, maxLength: 4 }),
    recipient: ethereumAddressArbitrary(),
    deadline: fc.integer({ min: Math.floor(Date.now() / 1000) + 300, max: Math.floor(Date.now() / 1000) + 86400 })
  }).filter(params => params.tokenIn !== params.tokenOut);

export const liquidityParamsArbitrary = () =>
  fc.record({
    tokenA: tokenSymbolArbitrary(),
    tokenB: tokenSymbolArbitrary(),
    amountA: tokenAmountArbitrary(),
    amountB: tokenAmountArbitrary(),
    minAmountA: tokenAmountArbitrary(),
    minAmountB: tokenAmountArbitrary(),
    recipient: ethereumAddressArbitrary(),
    deadline: fc.integer({ min: Math.floor(Date.now() / 1000) + 300, max: Math.floor(Date.now() / 1000) + 86400 })
  }).filter(params => params.tokenA !== params.tokenB);

// ============================================================================
// XCM Parameter Generators
// ============================================================================

export const chainNameArbitrary = (): fc.Arbitrary<string> =>
  fc.constantFrom('polkadot', 'hydration', 'bifrost', 'moonbeam', 'acala');

export const xcmTransferParamsArbitrary = () =>
  fc.record({
    fromChain: chainNameArbitrary(),
    toChain: chainNameArbitrary(),
    asset: tokenSymbolArbitrary(),
    amount: tokenAmountArbitrary(),
    sender: ethereumAddressArbitrary(),
    recipient: ethereumAddressArbitrary(),
    fee: tokenAmountArbitrary()
  }).filter(params => params.fromChain !== params.toChain);

export const multiLocationArbitrary = (): fc.Arbitrary<any> =>
  fc.record({
    parents: fc.integer({ min: 0, max: 2 }),
    interior: fc.record({
      x1: fc.record({
        parachain: fc.integer({ min: 1000, max: 3000 })
      })
    })
  });

// ============================================================================
// Transaction Parameter Generators
// ============================================================================

export const transactionParamsArbitrary = () =>
  fc.record({
    to: ethereumAddressArbitrary(),
    data: fc.string({ minLength: 8, maxLength: 1000 })
      .filter(s => /^[0-9a-fA-F]+$/.test(s))
      .map((hex: string) => `0x${hex}`),
    value: weiAmountArbitrary(),
    gasLimit: fc.bigInt({ min: 21000n, max: 10000000n }).map(g => g.toString()),
    gasPrice: fc.bigInt({ min: 1000000000n, max: 100000000000n }).map(g => g.toString()), // 1-100 gwei
    chainId: fc.constantFrom(1, 1284, 1285, 2004) // Ethereum, Moonbeam, Moonriver, Moonbeam parachain
  });

export const gasOptimizationArbitrary = () =>
  fc.record({
    urgency: fc.constantFrom('low', 'medium', 'high'),
    networkCongestion: percentageArbitrary(),
    baseFee: fc.bigInt({ min: 1000000000n, max: 50000000000n }).map(f => f.toString()),
    priorityFee: fc.bigInt({ min: 1000000000n, max: 10000000000n }).map(f => f.toString())
  });

// ============================================================================
// Security and Validation Generators
// ============================================================================

export const securityValidationContextArbitrary = () =>
  fc.record({
    intentId: fc.integer({ min: 1, max: 1000000 }),
    agentAddress: ethereumAddressArbitrary(),
    userAddress: ethereumAddressArbitrary(),
    protocols: fc.array(fc.constantFrom('hydration', 'bifrost', 'stellaswap', 'beamswap'), { minLength: 1, maxLength: 3 }),
    totalValue: weiAmountArbitrary(),
    riskLevel: fc.constantFrom('low', 'medium', 'high'),
    deadline: fc.integer({ min: Math.floor(Date.now() / 1000) + 300, max: Math.floor(Date.now() / 1000) + 86400 }),
    slippageTolerance: slippageArbitrary(),
    requiresTimelock: fc.boolean(),
    emergencyPauseCheck: fc.boolean()
  });

export const userLimitsArbitrary = () =>
  fc.record({
    dailyLimit: weiAmountArbitrary(),
    transactionLimit: weiAmountArbitrary(),
    protocolLimits: fc.dictionary(
      fc.constantFrom('hydration', 'bifrost', 'stellaswap', 'beamswap'),
      weiAmountArbitrary()
    ),
    riskLevel: fc.constantFrom('low', 'medium', 'high'),
    isActive: fc.boolean()
  });

// ============================================================================
// Error and Edge Case Generators
// ============================================================================

export const protocolErrorArbitrary = () =>
  fc.record({
    protocol: fc.constantFrom('hydration', 'bifrost', 'stellaswap', 'beamswap'),
    operation: fc.constantFrom('swap', 'liquidity', 'stake', 'bridge'),
    code: fc.constantFrom('INSUFFICIENT_BALANCE', 'SLIPPAGE_EXCEEDED', 'DEADLINE_PASSED', 'INVALID_PARAMS'),
    recoverable: fc.boolean(),
    retryAfter: fc.option(fc.integer({ min: 1000, max: 60000 })) // 1s to 1min
  });

export const networkErrorArbitrary = () =>
  fc.record({
    type: fc.constantFrom('RPC_ERROR', 'TIMEOUT', 'CONNECTION_LOST', 'RATE_LIMITED'),
    chain: chainNameArbitrary(),
    retryable: fc.boolean(),
    backoffMs: fc.integer({ min: 1000, max: 30000 })
  });

// ============================================================================
// Execution Plan Generators
// ============================================================================

export const executionStepArbitrary = () =>
  fc.record({
    stepId: fc.integer({ min: 1, max: 10 }),
    action: fc.constantFrom('bridge', 'swap', 'stake', 'provide_liquidity', 'claim_rewards'),
    protocol: fc.constantFrom('hydration', 'bifrost', 'stellaswap', 'beamswap'),
    chain: chainNameArbitrary(),
    tokenIn: fc.option(tokenSymbolArbitrary()),
    tokenOut: fc.option(tokenSymbolArbitrary()),
    amount: tokenAmountArbitrary(),
    minAmountOut: fc.option(tokenAmountArbitrary()),
    contractAddress: ethereumAddressArbitrary(),
    callData: fc.string({ minLength: 8, maxLength: 1000 })
      .filter(s => /^[0-9a-fA-F]+$/.test(s))
      .map((hex: string) => `0x${hex}`),
    estimatedGas: fc.bigInt({ min: 21000n, max: 1000000n }).map(g => g.toString()),
    description: fc.string({ minLength: 10, maxLength: 100 }),
    prerequisites: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { maxLength: 3 })
  });

export const executionPlanArbitrary = () =>
  fc.record({
    intentId: fc.integer({ min: 1, max: 1000000 }),
    steps: fc.array(executionStepArbitrary(), { minLength: 1, maxLength: 5 }),
    estimatedDuration: fc.integer({ min: 30, max: 3600 }), // 30s to 1h
    estimatedGasCost: weiAmountArbitrary(),
    riskLevel: fc.constantFrom('low', 'medium', 'high'),
    description: fc.string({ minLength: 20, maxLength: 200 })
  }).map(plan => ({
    ...plan,
    totalSteps: plan.steps.length,
    securityChecks: [],
    rollbackPlan: []
  }));

// ============================================================================
// Fund Movement Generators
// ============================================================================

export const transferParamsArbitrary = () =>
  fc.record({
    from: ethereumAddressArbitrary(),
    to: ethereumAddressArbitrary(),
    token: tokenSymbolArbitrary(),
    amount: tokenAmountArbitrary(),
    chain: chainNameArbitrary(),
    userAddress: ethereumAddressArbitrary(),
    intentId: fc.integer({ min: 1, max: 1000000 })
  });

export const fundMovementRecordArbitrary = () =>
  fc.record({
    id: fc.uuid(),
    intentId: fc.integer({ min: 1, max: 1000000 }),
    fromAddress: ethereumAddressArbitrary(),
    toAddress: ethereumAddressArbitrary(),
    token: tokenSymbolArbitrary(),
    amount: tokenAmountArbitrary(),
    chain: chainNameArbitrary(),
    transactionHash: transactionHashArbitrary(),
    blockNumber: fc.integer({ min: 1, max: 20000000 }),
    timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
    status: fc.constantFrom('pending', 'confirmed', 'failed'),
    gasUsed: fc.bigInt({ min: 21000n, max: 1000000n }).map(g => g.toString()),
    fees: weiAmountArbitrary(),
    movementType: fc.constantFrom('transfer', 'bridge', 'swap', 'stake')
  });

// ============================================================================
// Utility Functions for Property Tests
// ============================================================================

export const isValidEthereumAddress = (address: string): boolean => {
  return ethers.isAddress(address);
};

export const isValidAmount = (amount: string): boolean => {
  try {
    const parsed = BigInt(amount);
    return parsed > 0n;
  } catch {
    return false;
  }
};

export const isValidDeadline = (deadline: number): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return deadline > now && deadline < now + 86400 * 7; // Within 7 days
};

export const isValidSlippage = (slippage: number): boolean => {
  return slippage >= 0 && slippage <= 100;
};

export const isValidCallData = (callData: string): boolean => {
  return callData.startsWith('0x') && callData.length >= 10; // At least function selector
};

// ============================================================================
// Property Test Configuration
// ============================================================================

export const defaultPropertyTestConfig = {
  numRuns: 100,
  timeout: 30000, // 30 seconds
  verbose: false,
  seed: undefined,
  path: undefined,
  endOnFailure: false
};

export const fastPropertyTestConfig = {
  numRuns: 50,
  timeout: 15000, // 15 seconds
  verbose: false
};

export const thoroughPropertyTestConfig = {
  numRuns: 500,
  timeout: 60000, // 60 seconds
  verbose: true
};

// ============================================================================
// Test Data Validation Helpers
// ============================================================================

export const validateProtocolParams = (params: any, protocol: string): boolean => {
  switch (protocol) {
    case 'hydration':
      return params.tokenIn && params.tokenOut && params.amountIn && params.recipient;
    case 'bifrost':
      return params.asset && params.amount && params.recipient;
    case 'stellaswap':
    case 'beamswap':
      return params.tokenIn && params.tokenOut && params.amountIn && params.path && params.recipient;
    default:
      return false;
  }
};

export const validateXCMParams = (params: any): boolean => {
  return params.fromChain && 
         params.toChain && 
         params.fromChain !== params.toChain &&
         params.asset && 
         params.amount && 
         params.sender && 
         params.recipient;
};

export const validateTransactionParams = (params: any): boolean => {
  return isValidEthereumAddress(params.to) &&
         params.data &&
         isValidAmount(params.value) &&
         params.gasLimit &&
         params.gasPrice &&
         params.chainId;
};