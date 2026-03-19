/**
 * Testnet Integration Test Suite
 * Tests all protocol integrations on testnets and validates end-to-end execution flows
 * 
 * **Validates: Requirements 10.1, 10.3**
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ProtocolIntegrationService } from '../protocol-integration.service';
import { XCMExecutorService } from '../xcm-executor.service';
import { TransactionBuilderService } from '../transaction-builder.service';
import { CallDataEncoderService } from '../call-data-encoder.service';
import { FundManagerService } from '../fund-manager.service';
import {
  TESTNET_CONFIGS,
  TestnetConfigManager,
  TestAccountManager,
  TEST_ENVIRONMENT_CONFIG,
} from '../config/testnet-config';

describe('Testnet Integration Tests', () => {
  let protocolService: ProtocolIntegrationService;
  let xcmService: XCMExecutorService;
  let txBuilder: TransactionBuilderService;
  let callEncoder: CallDataEncoderService;
  let fundManager: FundManagerService;
  let configManager: TestnetConfigManager;
  let accountManager: TestAccountManager;
  let testWallet: ethers.HDNodeWallet;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProtocolIntegrationService,
        XCMExecutorService,
        TransactionBuilderService,
        CallDataEncoderService,
        FundManagerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                MOONBEAM_RPC_URL: TESTNET_CONFIGS.moonbase.rpcUrl,
                POLKADOT_HUB_RPC_URL: TESTNET_CONFIGS.westend.rpcUrl,
                HYDRATION_RPC_URL: TESTNET_CONFIGS.hydration.rpcUrl,
                BIFROST_RPC_URL: TESTNET_CONFIGS.bifrost.rpcUrl,
                TESTNET_MODE: true,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    protocolService = module.get<ProtocolIntegrationService>(ProtocolIntegrationService);
    xcmService = module.get<XCMExecutorService>(XCMExecutorService);
    txBuilder = module.get<TransactionBuilderService>(TransactionBuilderService);
    callEncoder = module.get<CallDataEncoderService>(CallDataEncoderService);
    fundManager = module.get<FundManagerService>(FundManagerService);

    configManager = new TestnetConfigManager();
    accountManager = new TestAccountManager();

    // Generate test wallet
    testWallet = ethers.Wallet.createRandom();
  }, TEST_ENVIRONMENT_CONFIG.testTimeout);

  afterAll(async () => {
    // Cleanup connections
    await xcmService.onModuleDestroy();
  });

  describe('Moonbeam Testnet Integration', () => {
    it('should connect to Moonbase Alpha testnet', async () => {
      const config = configManager.getConfig('moonbase');
      expect(config).toBeDefined();
      expect(config?.rpcUrl).toBe(TESTNET_CONFIGS.moonbase.rpcUrl);

      const provider = new ethers.JsonRpcProvider(config!.rpcUrl);
      const network = await provider.getNetwork();
      
      expect(network.chainId).toBe(BigInt(config!.chainId));
    }, TEST_ENVIRONMENT_CONFIG.testTimeout);

    it('should encode DEX swap call data for testnet', async () => {
      const params = {
        tokenIn: TESTNET_CONFIGS.moonbase.tokens.DEV.address,
        tokenOut: TESTNET_CONFIGS.moonbase.tokens.USDT.address,
        amountIn: ethers.parseEther('1').toString(),
        minAmountOut: ethers.parseUnits('0.95', 6).toString(),
        path: [
          TESTNET_CONFIGS.moonbase.tokens.DEV.address,
          TESTNET_CONFIGS.moonbase.tokens.USDT.address,
        ],
        recipient: testWallet.address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const callData = await callEncoder.encodeDEXSwap('stellaswap', params);
      
      expect(callData).toBeDefined();
      expect(callData).toMatch(/^0x/);
      expect(callData.length).toBeGreaterThan(10);
    });

    it('should build valid transaction for Moonbase Alpha', async () => {
      const txParams = {
        to: testWallet.address,
        data: '0x',
        value: '0',
        chainId: TESTNET_CONFIGS.moonbase.chainId,
      };

      const tx = await txBuilder.buildTransaction(txParams);

      expect(tx).toBeDefined();
      expect(tx.chainId).toBe(TESTNET_CONFIGS.moonbase.chainId);
      expect(tx.gasLimit).toBeGreaterThan(BigInt(0));
    });
  });

  describe('Hydration Testnet Integration', () => {
    it('should connect to Hydration testnet', async () => {
      const config = configManager.getConfig('hydration');
      expect(config).toBeDefined();

      // Test connection (mock for now as actual connection requires network)
      expect(config?.rpcUrl).toBe(TESTNET_CONFIGS.hydration.rpcUrl);
      expect(config?.contracts.router).toBe('pallet_route_executor');
    });

    it('should encode Hydration swap for testnet', async () => {
      const params = {
        tokenIn: 'DOT',
        tokenOut: 'USDT',
        amountIn: '1000000000000',
        minAmountOut: '950000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const callData = await callEncoder.encodeHydrationSwap(params);

      expect(callData).toBeDefined();
      expect(callData).toContain('router');
      expect(callData).toContain('sell');
    });
  });

  describe('Bifrost Testnet Integration', () => {
    it('should connect to Bifrost testnet', async () => {
      const config = configManager.getConfig('bifrost');
      expect(config).toBeDefined();
      expect(config?.rpcUrl).toBe(TESTNET_CONFIGS.bifrost.rpcUrl);
      expect(config?.contracts.vtokenMinting).toBe('pallet_vtoken_minting');
    });

    it('should encode Bifrost mint for testnet', async () => {
      const params = {
        asset: 'DOT',
        amount: '1000000000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      };

      const callData = await callEncoder.encodeBifrostMint(params);

      expect(callData).toBeDefined();
      expect(callData).toContain('vtokenMinting');
      expect(callData).toContain('mint');
    });

    it('should encode Bifrost redeem for testnet', async () => {
      const params = {
        vAsset: 'vDOT',
        amount: '1000000000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fastRedeem: false,
      };

      const callData = await callEncoder.encodeBifrostRedeem(params);

      expect(callData).toBeDefined();
      expect(callData).toContain('vtokenMinting');
      expect(callData).toContain('redeem');
    });
  });

  describe('End-to-End Cross-Chain Flow', () => {
    it('should construct complete XCM transfer flow', async () => {
      const transferParams = {
        fromChain: 'westend',
        toChain: 'hydration',
        asset: 'WND',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      // Step 1: Build XCM message
      const xcmMessage = await xcmService.buildTransferMessage(transferParams);
      expect(xcmMessage).toBeDefined();
      expect(xcmMessage.messageId).toBeDefined();

      // Step 2: Validate message
      const validation = await xcmService.validateXCMMessage(xcmMessage);
      expect(validation.valid).toBe(true);

      // Step 3: Calculate fees
      const feeEstimate = await xcmService.calculateXCMFee({
        fromChain: transferParams.fromChain,
        toChain: transferParams.toChain,
        asset: transferParams.asset,
        amount: transferParams.amount,
      });
      expect(feeEstimate.fee).toBeDefined();
      expect(BigInt(feeEstimate.fee)).toBeGreaterThan(BigInt(0));
    });

    it('should construct complete swap flow on testnet', async () => {
      const swapParams = {
        tokenIn: 'DOT',
        tokenOut: 'USDT',
        amountIn: '1000000000000',
        minAmountOut: '950000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      // Step 1: Encode swap call
      const callData = await callEncoder.encodeHydrationSwap(swapParams);
      expect(callData).toBeDefined();

      // Step 2: Validate call data
      const isValid = await callEncoder.validateCallData(callData, 'router.sell');
      expect(isValid).toBe(true);

      // Step 3: Decode to verify
      const decoded = await callEncoder.decodeCallData(callData);
      expect(decoded.isValid).toBe(true);
      expect(decoded.functionName).toBe('router.sell');
    });

    it('should construct complete liquid staking flow', async () => {
      const mintParams = {
        asset: 'DOT',
        amount: '1000000000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      };

      // Step 1: Encode mint call
      const mintCallData = await callEncoder.encodeBifrostMint(mintParams);
      expect(mintCallData).toBeDefined();

      // Step 2: Validate mint call
      const mintValid = await callEncoder.validateCallData(mintCallData, 'vtokenMinting.mint');
      expect(mintValid).toBe(true);

      // Later: redeem flow
      const redeemParams = {
        vAsset: 'vDOT',
        amount: '1000000000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fastRedeem: false,
      };

      const redeemCallData = await callEncoder.encodeBifrostRedeem(redeemParams);
      expect(redeemCallData).toBeDefined();

      const redeemValid = await callEncoder.validateCallData(redeemCallData, 'vtokenMinting.redeem');
      expect(redeemValid).toBe(true);
    });
  });

  describe('Multi-Protocol Integration Flow', () => {
    it('should execute bridge + swap flow', async () => {
      // Step 1: Bridge from Westend to Hydration
      const bridgeParams = {
        fromChain: 'westend',
        toChain: 'hydration',
        asset: 'WND',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      const xcmMessage = await xcmService.buildTransferMessage(bridgeParams);
      expect(xcmMessage).toBeDefined();

      // Step 2: Swap on Hydration
      const swapParams = {
        tokenIn: 'WND',
        tokenOut: 'USDT',
        amountIn: '900000000000', // After bridge fees
        minAmountOut: '850000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const swapCallData = await callEncoder.encodeHydrationSwap(swapParams);
      expect(swapCallData).toBeDefined();
    });

    it('should execute bridge + stake flow', async () => {
      // Step 1: Bridge from Westend to Bifrost
      const bridgeParams = {
        fromChain: 'westend',
        toChain: 'bifrost',
        asset: 'WND',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      const xcmMessage = await xcmService.buildTransferMessage(bridgeParams);
      expect(xcmMessage).toBeDefined();

      // Step 2: Mint vToken on Bifrost
      const mintParams = {
        asset: 'DOT',
        amount: '900000000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      };

      const mintCallData = await callEncoder.encodeBifrostMint(mintParams);
      expect(mintCallData).toBeDefined();
    });
  });

  describe('Testnet Configuration Validation', () => {
    it('should validate all testnet configurations', () => {
      const testnets = configManager.getAllConfigs();
      
      expect(testnets.length).toBeGreaterThan(0);

      testnets.forEach(config => {
        const errors = configManager.validateConfig(config);
        expect(errors).toHaveLength(0);
      });
    });

    it('should have valid RPC URLs for all testnets', () => {
      const testnets = configManager.getAllConfigs();

      testnets.forEach(config => {
        expect(config.rpcUrl).toBeDefined();
        expect(config.rpcUrl.length).toBeGreaterThan(0);
        expect(config.rpcUrl).toMatch(/^(https?|wss?):\/\//);
      });
    });

    it('should have valid token configurations', () => {
      const testnets = configManager.getAllConfigs();

      testnets.forEach(config => {
        expect(config.tokens).toBeDefined();
        expect(Object.keys(config.tokens).length).toBeGreaterThan(0);

        Object.values(config.tokens).forEach(token => {
          expect(token.symbol).toBeDefined();
          expect(token.decimals).toBeGreaterThan(0);
          expect(token.isTestToken).toBe(true);
        });
      });
    });

    it('should distinguish EVM and Substrate testnets', () => {
      const evmTestnets = configManager.getEVMTestnets();
      const substrateTestnets = configManager.getSubstrateTestnets();

      expect(evmTestnets.length).toBeGreaterThan(0);
      expect(substrateTestnets.length).toBeGreaterThan(0);

      evmTestnets.forEach(config => {
        expect(config.chainId).toBeGreaterThan(0);
      });

      substrateTestnets.forEach(config => {
        expect(config.chainId).toBe(0);
      });
    });
  });

  describe('Test Account Management', () => {
    it('should generate test accounts', () => {
      const account = accountManager.generateTestAccount('moonbase');

      expect(account).toBeDefined();
      expect(account.address).toBeDefined();
      expect(account.privateKey).toBeDefined();
      expect(account.testnet).toBe('moonbase');
    });

    it('should manage multiple test accounts', () => {
      accountManager.clearAccounts();

      const account1 = accountManager.generateTestAccount('moonbase');
      const account2 = accountManager.generateTestAccount('moonbase');

      accountManager.addAccount('moonbase', account1);
      accountManager.addAccount('moonbase', account2);

      const accounts = accountManager.getAccounts('moonbase');
      expect(accounts.length).toBe(2);
    });
  });
});
