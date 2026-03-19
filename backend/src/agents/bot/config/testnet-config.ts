/**
 * Testnet configuration for protocol execution testing
 * Contains real testnet endpoints and contract addresses for safe testing
 */

import { ethers } from 'ethers';

export interface TestnetConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  wsUrl?: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: Record<string, string>;
  tokens: Record<string, TokenConfig>;
  faucets?: string[];
}

export interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isTestToken: boolean;
}

// ============================================================================
// Moonbeam Alpha Testnet Configuration
// ============================================================================

export const MOONBASE_ALPHA_CONFIG: TestnetConfig = {
  name: 'Moonbase Alpha',
  chainId: 1287,
  rpcUrl: 'https://rpc.api.moonbase.moonbeam.network',
  wsUrl: 'wss://wss.api.moonbase.moonbeam.network',
  blockExplorer: 'https://moonbase.moonscan.io',
  nativeCurrency: {
    name: 'DEV',
    symbol: 'DEV',
    decimals: 18
  },
  contracts: {
    // StellaSwap testnet contracts (if available)
    stellaswapRouter: '0x0000000000000000000000000000000000000000', // Placeholder
    stellaswapFactory: '0x0000000000000000000000000000000000000000', // Placeholder
    
    // BeamSwap testnet contracts (if available)
    beamswapRouter: '0x0000000000000000000000000000000000000000', // Placeholder
    beamswapFactory: '0x0000000000000000000000000000000000000000', // Placeholder
    
    // Test multicall contract
    multicall: '0x0000000000000000000000000000000000000000' // Placeholder
  },
  tokens: {
    DEV: {
      address: '0x0000000000000000000000000000000000000000', // Native token
      symbol: 'DEV',
      name: 'Moonbase Alpha DEV',
      decimals: 18,
      isTestToken: true
    },
    USDT: {
      address: '0x0000000000000000000000000000000000000000', // Test USDT
      symbol: 'USDT',
      name: 'Test Tether USD',
      decimals: 6,
      isTestToken: true
    },
    USDC: {
      address: '0x0000000000000000000000000000000000000000', // Test USDC
      symbol: 'USDC',
      name: 'Test USD Coin',
      decimals: 6,
      isTestToken: true
    }
  },
  faucets: [
    'https://apps.moonbeam.network/moonbase-alpha/faucet/'
  ]
};

// ============================================================================
// Polkadot Testnet Configuration (Westend)
// ============================================================================

export const WESTEND_CONFIG: TestnetConfig = {
  name: 'Westend',
  chainId: 0, // Substrate chain
  rpcUrl: 'wss://westend-rpc.polkadot.io',
  blockExplorer: 'https://westend.subscan.io',
  nativeCurrency: {
    name: 'Westend',
    symbol: 'WND',
    decimals: 12
  },
  contracts: {},
  tokens: {
    WND: {
      address: 'native',
      symbol: 'WND',
      name: 'Westend',
      decimals: 12,
      isTestToken: true
    }
  },
  faucets: [
    'https://matrix.to/#/#westend_faucet:matrix.org'
  ]
};

// ============================================================================
// Hydration Testnet Configuration (HydraDX Snakenet)
// ============================================================================

export const HYDRATION_TESTNET_CONFIG: TestnetConfig = {
  name: 'HydraDX Snakenet',
  chainId: 0, // Substrate chain
  rpcUrl: 'wss://rpc.nice.hydration.cloud',
  blockExplorer: 'https://snakenet.subscan.io',
  nativeCurrency: {
    name: 'HDX',
    symbol: 'HDX',
    decimals: 12
  },
  contracts: {
    omnipool: 'pallet_omnipool',
    router: 'pallet_route_executor',
    multicurrency: 'pallet_currencies'
  },
  tokens: {
    HDX: {
      address: '0',
      symbol: 'HDX',
      name: 'HydraDX',
      decimals: 12,
      isTestToken: true
    },
    DOT: {
      address: '5',
      symbol: 'DOT',
      name: 'Polkadot',
      decimals: 10,
      isTestToken: true
    },
    USDT: {
      address: '10',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      isTestToken: true
    }
  },
  faucets: [
    'https://discord.gg/kkmY35UxAG' // HydraDX Discord faucet
  ]
};

// ============================================================================
// Bifrost Testnet Configuration
// ============================================================================

export const BIFROST_TESTNET_CONFIG: TestnetConfig = {
  name: 'Bifrost Testnet',
  chainId: 0, // Substrate chain
  rpcUrl: 'wss://bifrost-rpc.testnet.liebi.com/ws',
  blockExplorer: 'https://bifrost-testnet.subscan.io',
  nativeCurrency: {
    name: 'BNC',
    symbol: 'BNC',
    decimals: 12
  },
  contracts: {
    slp: 'pallet_slp',
    vtokenMinting: 'pallet_vtoken_minting',
    farming: 'pallet_farming',
    xcmInterface: 'pallet_xcm_interface'
  },
  tokens: {
    BNC: {
      address: 'native',
      symbol: 'BNC',
      name: 'Bifrost Native Coin',
      decimals: 12,
      isTestToken: true
    },
    DOT: {
      address: '2001',
      symbol: 'DOT',
      name: 'Polkadot',
      decimals: 10,
      isTestToken: true
    },
    vDOT: {
      address: '2001',
      symbol: 'vDOT',
      name: 'Voucher DOT',
      decimals: 10,
      isTestToken: true
    },
    KSM: {
      address: '516',
      symbol: 'KSM',
      name: 'Kusama',
      decimals: 12,
      isTestToken: true
    },
    vKSM: {
      address: '516',
      symbol: 'vKSM',
      name: 'Voucher KSM',
      decimals: 12,
      isTestToken: true
    }
  }
};

// ============================================================================
// Testnet Registry
// ============================================================================

export const TESTNET_CONFIGS = {
  moonbase: MOONBASE_ALPHA_CONFIG,
  westend: WESTEND_CONFIG,
  hydration: HYDRATION_TESTNET_CONFIG,
  bifrost: BIFROST_TESTNET_CONFIG
} as const;

export type TestnetName = keyof typeof TESTNET_CONFIGS;

// ============================================================================
// Testnet Utilities
// ============================================================================

export class TestnetConfigManager {
  private configs: Map<string, TestnetConfig> = new Map();

  constructor() {
    // Load default configurations
    Object.entries(TESTNET_CONFIGS).forEach(([name, config]) => {
      this.configs.set(name, config);
    });
  }

  getConfig(name: TestnetName): TestnetConfig | null {
    return this.configs.get(name) || null;
  }

  getAllConfigs(): TestnetConfig[] {
    return Array.from(this.configs.values());
  }

  getEVMTestnets(): TestnetConfig[] {
    return this.getAllConfigs().filter(config => config.chainId > 0);
  }

  getSubstrateTestnets(): TestnetConfig[] {
    return this.getAllConfigs().filter(config => config.chainId === 0);
  }

  addCustomConfig(name: string, config: TestnetConfig): void {
    this.configs.set(name, config);
  }

  removeConfig(name: string): boolean {
    return this.configs.delete(name);
  }

  validateConfig(config: TestnetConfig): string[] {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('Config must have a name');
    }

    if (!config.rpcUrl) {
      errors.push('Config must have an RPC URL');
    }

    if (!config.nativeCurrency) {
      errors.push('Config must specify native currency');
    }

    if (config.chainId < 0) {
      errors.push('Chain ID must be non-negative');
    }

    return errors;
  }

  isTestnetAvailable(name: TestnetName): boolean {
    const config = this.getConfig(name);
    return config !== null;
  }

  getTokenAddress(testnet: TestnetName, symbol: string): string | null {
    const config = this.getConfig(testnet);
    if (!config) return null;

    const token = config.tokens[symbol];
    return token ? token.address : null;
  }

  getContractAddress(testnet: TestnetName, contractName: string): string | null {
    const config = this.getConfig(testnet);
    if (!config) return null;

    return config.contracts[contractName] || null;
  }
}

// ============================================================================
// Environment-specific Configuration
// ============================================================================

export interface TestEnvironmentConfig {
  defaultTestnet: TestnetName;
  enabledTestnets: TestnetName[];
  testTimeout: number;
  maxRetries: number;
  gasMultiplier: number;
  confirmationBlocks: number;
}

export const TEST_ENVIRONMENT_CONFIG: TestEnvironmentConfig = {
  defaultTestnet: 'moonbase',
  enabledTestnets: ['moonbase', 'westend', 'hydration', 'bifrost'],
  testTimeout: 60000, // 60 seconds
  maxRetries: 3,
  gasMultiplier: 1.2, // 20% buffer
  confirmationBlocks: 1
};

// ============================================================================
// Test Account Management
// ============================================================================

export interface TestAccount {
  address: string;
  privateKey: string;
  mnemonic?: string;
  testnet: TestnetName;
  balance?: string;
  nonce?: number;
}

export class TestAccountManager {
  private accounts: Map<string, TestAccount[]> = new Map();

  addAccount(testnet: TestnetName, account: TestAccount): void {
    const existing = this.accounts.get(testnet) || [];
    existing.push(account);
    this.accounts.set(testnet, existing);
  }

  getAccounts(testnet: TestnetName): TestAccount[] {
    return this.accounts.get(testnet) || [];
  }

  getAccount(testnet: TestnetName, index: number = 0): TestAccount | null {
    const accounts = this.getAccounts(testnet);
    return accounts[index] || null;
  }

  generateTestAccount(testnet: TestnetName): TestAccount {
    const wallet = ethers.Wallet.createRandom();
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase,
      testnet,
      balance: '0',
      nonce: 0
    };
  }

  clearAccounts(testnet?: TestnetName): void {
    if (testnet) {
      this.accounts.delete(testnet);
    } else {
      this.accounts.clear();
    }
  }
}

// ============================================================================
// Export Singleton Instances
// ============================================================================

export const testnetConfigManager = new TestnetConfigManager();
export const testAccountManager = new TestAccountManager();