/**
 * Unit tests for Transaction Builder Service
 * Tests transaction construction, signing, gas optimization, and nonce management
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
import { TransactionBuilderService } from '../transaction-builder.service';
import {
  TransactionParams,
  UnsignedTransaction,
} from '../interfaces/protocol-execution.interfaces';

describe('TransactionBuilderService', () => {
  let service: TransactionBuilderService;
  let testWallet: ethers.HDNodeWallet;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionBuilderService],
    }).compile();

    service = module.get<TransactionBuilderService>(TransactionBuilderService);
    
    // Create a test wallet
    testWallet = ethers.Wallet.createRandom();
    
    // Mock the provider methods to avoid network calls
    jest.spyOn(service as any, 'getProvider').mockReturnValue({
      getTransactionCount: jest.fn().mockResolvedValue(0),
      estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt(1000000000),
      }),
      broadcastTransaction: jest.fn().mockResolvedValue({
        hash: '0x1234567890abcdef',
      }),
      waitForTransaction: jest.fn().mockResolvedValue({
        blockNumber: 12345,
        status: 1,
      }),
    });
  });

  afterEach(() => {
    // Clear caches between tests
    service.clearGasPriceCache();
  });

  describe('buildTransaction', () => {
    it('should build a valid unsigned transaction', async () => {
      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: '0x',
        value: '1000000000000000000', // 1 ETH
        chainId: 1287,
      };

      const tx = await service.buildTransaction(params);

      expect(tx).toBeDefined();
      expect(tx.to).toBe(params.to);
      expect(tx.data).toBe(params.data);
      expect(tx.value).toBe(BigInt(params.value));
      expect(tx.chainId).toBe(params.chainId);
      expect(tx.nonce).toBeGreaterThanOrEqual(0);
      expect(tx.gasLimit).toBeGreaterThan(BigInt(0));
      expect(tx.gasPrice).toBeGreaterThan(BigInt(0));
    });

    it('should use provided nonce when specified', async () => {
      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: '0x',
        value: '0',
        chainId: 1287,
        nonce: 42,
      };

      const tx = await service.buildTransaction(params);

      expect(tx.nonce).toBe(42);
    });

    it('should handle zero value transactions', async () => {
      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: '0x1234',
        value: '0',
        chainId: 1287,
      };

      const tx = await service.buildTransaction(params);

      expect(tx.value).toBe(BigInt(0));
    });
  });

  describe('signTransaction', () => {
    it('should sign a transaction and produce valid signature', async () => {
      const unsignedTx: UnsignedTransaction = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'.toLowerCase(),
        data: '0x',
        value: BigInt(1000000000000000000),
        gasLimit: BigInt(21000),
        gasPrice: BigInt(1000000000),
        nonce: 0,
        chainId: 1287,
      };

      const signedTx = await service.signTransaction(unsignedTx, testWallet);

      expect(signedTx).toBeDefined();
      expect(signedTx.signature).toBeDefined();
      expect(signedTx.signature.r).toBeDefined();
      expect(signedTx.signature.s).toBeDefined();
      expect(signedTx.signature.v).toBeDefined();
      expect(signedTx.hash).toBeDefined();
      expect(signedTx.hash.startsWith('0x')).toBe(true);
    });
  });

  describe('optimizeGasPrice', () => {
    it('should return gas price for different urgency levels', async () => {
      const lowGasPrice = await service.optimizeGasPrice('low');
      const mediumGasPrice = await service.optimizeGasPrice('medium');
      const highGasPrice = await service.optimizeGasPrice('high');

      expect(lowGasPrice).toBeGreaterThan(BigInt(0));
      expect(mediumGasPrice).toBeGreaterThan(BigInt(0));
      expect(highGasPrice).toBeGreaterThan(BigInt(0));
      expect(highGasPrice).toBeGreaterThan(lowGasPrice);
    });
  });

  describe('buildBatchTransaction', () => {
    it('should build batch transaction from multiple transactions', async () => {
      const txs: UnsignedTransaction[] = [
        {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          data: '0x',
          value: BigInt(1000000000000000000),
          gasLimit: BigInt(21000),
          gasPrice: BigInt(1000000000),
          nonce: 0,
          chainId: 1287,
        },
        {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          data: '0x',
          value: BigInt(2000000000000000000),
          gasLimit: BigInt(21000),
          gasPrice: BigInt(1000000000),
          nonce: 1,
          chainId: 1287,
        },
      ];

      const batch = await service.buildBatchTransaction(txs);

      expect(batch).toBeDefined();
      expect(batch.transactions).toHaveLength(2);
      expect(batch.totalGasLimit).toBe(BigInt(42000));
      expect(batch.estimatedCost).toBeDefined();
    });

    it('should throw error for empty batch', async () => {
      await expect(service.buildBatchTransaction([])).rejects.toThrow();
    });
  });

  describe('nonce management', () => {
    it('should reset nonce tracker', () => {
      const address = testWallet.address;
      service.setNonce(address, 10);
      service.resetNonce(address);
      
      const state = service.getNonceTrackerState();
      expect(state.has(address.toLowerCase())).toBe(false);
    });

    it('should manually set nonce', () => {
      const address = testWallet.address;
      service.setNonce(address, 42);
      
      const state = service.getNonceTrackerState();
      expect(state.get(address.toLowerCase())).toBe(42);
    });
  });
});
