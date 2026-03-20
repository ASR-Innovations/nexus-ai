/**
 * Test setup for protocol execution testing
 * Configures test environment, mocks, and utilities
 */

import { TestnetConfigManager, TestAccountManager } from '../config/testnet-config';

// ============================================================================
// Global Test Configuration
// ============================================================================

// Increase timeout for property-based tests
jest.setTimeout(60000);

// Configure console output for tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress expected error logs during testing
  console.error = (...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string') {
      // Suppress known test-related errors
      if (message.includes('Property test failed') || 
          message.includes('Expected error for testing')) {
        return;
      }
    }
    originalConsoleError(...args);
  };

  console.warn = (...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string') {
      // Suppress known test-related warnings
      if (message.includes('Test warning') || 
          message.includes('Mock implementation')) {
        return;
      }
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// ============================================================================
// Test Environment Setup
// ============================================================================

// Global test managers
export const testConfigManager = new TestnetConfigManager();
export const testAccountManager = new TestAccountManager();

// Test environment variables
process.env.NODE_ENV = 'test';
process.env.AGENT_BOT_ENABLED = 'false'; // Disable bot during tests
process.env.MOCK_EXTERNAL_APIS = 'true';

// ============================================================================
// Mock Implementations
// ============================================================================

// Mock ethers provider for testing
export const mockProvider = {
  getBalance: jest.fn().mockResolvedValue('1000000000000000000'), // 1 ETH
  getFeeData: jest.fn().mockResolvedValue({
    gasPrice: '20000000000', // 20 gwei
    maxFeePerGas: '30000000000', // 30 gwei
    maxPriorityFeePerGas: '2000000000' // 2 gwei
  }),
  estimateGas: jest.fn().mockResolvedValue('100000'),
  getTransactionCount: jest.fn().mockResolvedValue(0),
  sendTransaction: jest.fn().mockResolvedValue({
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    wait: jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 12345,
      gasUsed: '95000',
      transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    })
  }),
  getNetwork: jest.fn().mockResolvedValue({
    chainId: 1287,
    name: 'moonbase-alpha'
  })
};

// Mock wallet for testing
export const mockWallet: any = {
  address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
  privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  signTransaction: jest.fn().mockResolvedValue('0xsignedtransaction'),
  sendTransaction: jest.fn().mockImplementation(() => mockProvider.sendTransaction()),
  connect: jest.fn()
};

// Set up circular reference after object creation
mockWallet.connect.mockReturnValue(mockWallet);

// Mock contract for testing
export const mockContract = {
  interface: {
    encodeFunctionData: jest.fn().mockReturnValue('0xabcdef'),
    decodeFunctionData: jest.fn().mockReturnValue(['param1', 'param2'])
  },
  estimateGas: {
    swapExactTokensForTokens: jest.fn().mockResolvedValue('150000'),
    addLiquidity: jest.fn().mockResolvedValue('200000'),
    mint: jest.fn().mockResolvedValue('120000')
  },
  swapExactTokensForTokens: jest.fn().mockResolvedValue(mockProvider.sendTransaction()),
  addLiquidity: jest.fn().mockResolvedValue(mockProvider.sendTransaction()),
  mint: jest.fn().mockResolvedValue(mockProvider.sendTransaction())
};

// ============================================================================
// Test Utilities
// ============================================================================

export const createTestExecutionContext = () => ({
  intentId: 1,
  agentAddress: mockWallet.address,
  wallet: mockWallet,
  provider: mockProvider,
  maxGasPrice: BigInt('30000000000'),
  slippageTolerance: 0.005
});

export const createTestIntent = () => ({
  id: 1,
  userAddress: '0x123456789abcdef123456789abcdef123456789a',
  goalHash: 'test-goal-hash',
  amount: BigInt('1000000000000000000'), // 1 ETH
  deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  maxSlippageBps: 50, // 0.5%
  approvedProtocols: ['hydration', 'bifrost', 'stellaswap'],
  status: 'PENDING'
});

export const createTestExecutionStep = () => ({
  stepId: 1,
  action: 'swap' as const,
  protocol: 'hydration',
  chain: 'hydration',
  tokenIn: 'DOT',
  tokenOut: 'USDT',
  amount: '1000000000000', // 1 DOT
  minAmountOut: '7000000', // 7 USDT
  contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
  callData: '0xabcdef1234567890',
  estimatedGas: '150000',
  description: 'Swap DOT to USDT on Hydration',
  prerequisites: []
});

export const waitForAsync = (ms: number = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const expectAsyncError = async (
  asyncFn: () => Promise<any>,
  expectedError?: string | RegExp
): Promise<Error> => {
  try {
    await asyncFn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect((error as Error).message).toContain(expectedError);
      } else {
        expect((error as Error).message).toMatch(expectedError);
      }
    }
    return error as Error;
  }
};

// ============================================================================
// Property Test Helpers
// ============================================================================

export const runPropertyTest = async (
  testName: string,
  property: any,
  config: any = {}
) => {
  const fc = require('fast-check');
  
  try {
    await fc.assert(property, {
      numRuns: 100,
      timeout: 30000,
      verbose: false,
      ...config
    });
  } catch (error) {
    console.error(`Property test failed: ${testName}`, error);
    throw error;
  }
};

export const createPropertyTestSuite = (suiteName: string, tests: Array<{
  name: string;
  property: any;
  config?: any;
}>) => {
  describe(`Property Tests: ${suiteName}`, () => {
    tests.forEach(({ name, property, config }) => {
      test(name, async () => {
        await runPropertyTest(name, property, config);
      });
    });
  });
};

// ============================================================================
// Mock Reset Utilities
// ============================================================================

export const resetAllMocks = () => {
  jest.clearAllMocks();
  
  // Reset mock implementations to defaults
  mockProvider.getBalance.mockResolvedValue('1000000000000000000');
  mockProvider.getFeeData.mockResolvedValue({
    gasPrice: '20000000000',
    maxFeePerGas: '30000000000',
    maxPriorityFeePerGas: '2000000000'
  });
  mockProvider.estimateGas.mockResolvedValue('100000');
  mockProvider.getTransactionCount.mockResolvedValue(0);
  
  mockContract.interface.encodeFunctionData.mockReturnValue('0xabcdef');
  mockContract.interface.decodeFunctionData.mockReturnValue(['param1', 'param2']);
};

// Reset mocks before each test
beforeEach(() => {
  resetAllMocks();
});

// ============================================================================
// Test Data Generators
// ============================================================================

export const generateTestAddress = (): string => {
  const randomHex = Math.random().toString(16).substring(2, 42);
  return `0x${randomHex.padStart(40, '0')}`;
};

export const generateTestAmount = (min: number = 1, max: number = 1000): string => {
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;
  return (BigInt(amount) * BigInt('1000000000000000000')).toString(); // Convert to wei
};

export const generateTestTokenSymbol = (): string => {
  const symbols = ['DOT', 'KSM', 'GLMR', 'USDT', 'USDC', 'HDX', 'vDOT', 'vKSM'];
  return symbols[Math.floor(Math.random() * symbols.length)];
};

export const generateTestDeadline = (): number => {
  const now = Math.floor(Date.now() / 1000);
  return now + Math.floor(Math.random() * 3600) + 300; // 5 minutes to 1 hour from now
};

// ============================================================================
// Integration Test Helpers
// ============================================================================

export const skipIfNoTestnet = (testnetName: string) => {
  const config = testConfigManager.getConfig(testnetName as any);
  if (!config) {
    console.warn(`Skipping test: ${testnetName} testnet not configured`);
    return true;
  }
  return false;
};

export const requireTestnet = (testnetName: string) => {
  if (skipIfNoTestnet(testnetName)) {
    throw new Error(`Test requires ${testnetName} testnet configuration`);
  }
};

// ============================================================================
// Cleanup
// ============================================================================

afterEach(() => {
  // Clean up any test-specific state
  testAccountManager.clearAccounts();
});

export default {
  testConfigManager,
  testAccountManager,
  mockProvider,
  mockWallet,
  mockContract,
  createTestExecutionContext,
  createTestIntent,
  createTestExecutionStep,
  waitForAsync,
  expectAsyncError,
  runPropertyTest,
  createPropertyTestSuite,
  resetAllMocks,
  generateTestAddress,
  generateTestAmount,
  generateTestTokenSymbol,
  generateTestDeadline,
  skipIfNoTestnet,
  requireTestnet
};