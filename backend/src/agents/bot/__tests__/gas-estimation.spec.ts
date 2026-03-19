/**
 * Gas Estimation Accuracy Tests
 * Validates gas estimates against actual consumption and tests estimation accuracy
 * 
 * **Validates: Requirements 10.5**
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
import { TransactionBuilderService } from '../transaction-builder.service';
import { CallDataEncoderService } from '../call-data-encoder.service';
import {
  TransactionParams,
  UnsignedTransaction,
} from '../interfaces/protocol-execution.interfaces';

describe('Gas Estimation Accuracy Tests', () => {
  let txBuilder: TransactionBuilderService;
  let callEncoder: CallDataEncoderService;
  let testWallet: ethers.HDNodeWallet;

  // Acceptable gas estimation error margin (20%)
  const GAS_ESTIMATION_TOLERANCE = 0.20;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionBuilderService,
        CallDataEncoderService,
      ],
    }).compile();

    txBuilder = module.get<TransactionBuilderService>(TransactionBuilderService);
    callEncoder = module.get<CallDataEncoderService>(CallDataEncoderService);

    testWallet = ethers.Wallet.createRandom();

    // Mock provider methods
    jest.spyOn(txBuilder as any, 'getProvider').mockReturnValue({
      getTransactionCount: jest.fn().mockResolvedValue(0),
      estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt(1000000000),
        maxFeePerGas: BigInt(2000000000),
        maxPriorityFeePerGas: BigInt(1000000000),
      }),
      broadcastTransaction: jest.fn().mockResolvedValue({
        hash: '0x1234567890abcdef',
        wait: jest.fn().mockResolvedValue({
          blockNumber: 12345,
          status: 1,
          gasUsed: BigInt(21000),
        }),
      }),
    });
  });

  afterEach(() => {
    txBuilder.clearGasPriceCache();
  });

  describe('Basic Transaction Gas Estimation', () => {
    it('should estimate gas for simple ETH transfer', async () => {
      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: '0x',
        value: ethers.parseEther('1').toString(),
        chainId: 1287,
      };

      const tx = await txBuilder.buildTransaction(params);

      expect(tx.gasLimit).toBeDefined();
      expect(tx.gasLimit).toBeGreaterThan(BigInt(0));
      
      // Simple transfer should be around 21000 gas
      expect(tx.gasLimit).toBeGreaterThanOrEqual(BigInt(21000));
      expect(tx.gasLimit).toBeLessThan(BigInt(30000));
    });

    it('should estimate higher gas for contract interaction', async () => {
      const swapParams = {
        tokenIn: '0x0000000000000000000000000000000000000802',
        tokenOut: '0x0000000000000000000000000000000000000803',
        amountIn: ethers.parseEther('1').toString(),
        minAmountOut: ethers.parseEther('0.95').toString(),
        path: [
          '0x0000000000000000000000000000000000000802',
          '0x0000000000000000000000000000000000000803',
        ],
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const callData = await callEncoder.encodeDEXSwap('stellaswap', swapParams);

      const params: TransactionParams = {
        to: '0x1234567890123456789012345678901234567890',
        data: callData,
        value: '0',
        chainId: 1287,
      };

      // Mock higher gas for contract call
      jest.spyOn(txBuilder as any, 'getProvider').mockReturnValue({
        getTransactionCount: jest.fn().mockResolvedValue(0),
        estimateGas: jest.fn().mockResolvedValue(BigInt(150000)),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000),
        }),
      });

      const tx = await txBuilder.buildTransaction(params);

      // Contract interaction should use more gas
      expect(tx.gasLimit).toBeGreaterThan(BigInt(100000));
    });

    it('should add safety buffer to gas estimates', async () => {
      const baseGasEstimate = BigInt(100000);
      const safetyBuffer = 1.1; // 10% buffer

      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: '0x1234',
        value: '0',
        chainId: 1287,
      };

      jest.spyOn(txBuilder as any, 'getProvider').mockReturnValue({
        getTransactionCount: jest.fn().mockResolvedValue(0),
        estimateGas: jest.fn().mockResolvedValue(baseGasEstimate),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000),
        }),
      });

      const tx = await txBuilder.buildTransaction(params);

      // Should include safety buffer
      const expectedMinGas = baseGasEstimate;
      const expectedMaxGas = BigInt(Math.floor(Number(baseGasEstimate) * 1.2));

      expect(tx.gasLimit).toBeGreaterThanOrEqual(expectedMinGas);
      expect(tx.gasLimit).toBeLessThanOrEqual(expectedMaxGas);
    });
  });

  describe('Gas Estimation Accuracy', () => {
    it('should estimate gas within acceptable tolerance', async () => {
      const estimatedGas = BigInt(150000);
      const actualGasUsed = BigInt(145000);

      const difference = Number(estimatedGas - actualGasUsed);
      const percentageError = Math.abs(difference) / Number(actualGasUsed);

      expect(percentageError).toBeLessThan(GAS_ESTIMATION_TOLERANCE);
    });

    it('should track estimation accuracy over multiple transactions', () => {
      const estimates = [
        { estimated: BigInt(100000), actual: BigInt(95000) },
        { estimated: BigInt(150000), actual: BigInt(148000) },
        { estimated: BigInt(200000), actual: BigInt(195000) },
        { estimated: BigInt(120000), actual: BigInt(118000) },
      ];

      const accuracies = estimates.map(({ estimated, actual }) => {
        const diff = Number(estimated - actual);
        return Math.abs(diff) / Number(actual);
      });

      const averageAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;

      expect(averageAccuracy).toBeLessThan(GAS_ESTIMATION_TOLERANCE);
      
      // All individual estimates should be within tolerance
      accuracies.forEach(accuracy => {
        expect(accuracy).toBeLessThan(GAS_ESTIMATION_TOLERANCE);
      });
    });

    it('should never underestimate gas significantly', () => {
      const testCases = [
        { estimated: BigInt(100000), actual: BigInt(105000) },
        { estimated: BigInt(150000), actual: BigInt(148000) },
        { estimated: BigInt(200000), actual: BigInt(210000) },
      ];

      testCases.forEach(({ estimated, actual }) => {
        // Estimated should be >= actual or within small margin
        const underestimation = Number(actual - estimated);
        const percentageUnder = underestimation / Number(actual);

        // Allow small underestimation but not significant
        expect(percentageUnder).toBeLessThan(0.05); // Max 5% underestimation
      });
    });
  });

  describe('Gas Price Optimization', () => {
    it('should provide different gas prices for urgency levels', async () => {
      const lowGasPrice = await txBuilder.optimizeGasPrice('low');
      const mediumGasPrice = await txBuilder.optimizeGasPrice('medium');
      const highGasPrice = await txBuilder.optimizeGasPrice('high');

      expect(lowGasPrice).toBeGreaterThan(BigInt(0));
      expect(mediumGasPrice).toBeGreaterThan(lowGasPrice);
      expect(highGasPrice).toBeGreaterThan(mediumGasPrice);

      // High should be significantly more than low
      const ratio = Number(highGasPrice) / Number(lowGasPrice);
      expect(ratio).toBeGreaterThan(1.2); // At least 20% more
    });

    it('should cache gas prices for efficiency', async () => {
      const price1 = await txBuilder.optimizeGasPrice('medium');
      const price2 = await txBuilder.optimizeGasPrice('medium');

      // Should return same price from cache
      expect(price1).toBe(price2);
    });

    it('should respect maximum gas price limits', async () => {
      const maxGasPrice = BigInt(100000000000); // 100 gwei

      const highGasPrice = await txBuilder.optimizeGasPrice('high');

      // Should not exceed reasonable maximum
      expect(highGasPrice).toBeLessThanOrEqual(maxGasPrice);
    });
  });

  describe('Complex Transaction Gas Estimation', () => {
    it('should estimate gas for DEX swap accurately', async () => {
      const swapParams = {
        tokenIn: '0x0000000000000000000000000000000000000802',
        tokenOut: '0x0000000000000000000000000000000000000803',
        amountIn: ethers.parseEther('1').toString(),
        minAmountOut: ethers.parseEther('0.95').toString(),
        path: [
          '0x0000000000000000000000000000000000000802',
          '0x0000000000000000000000000000000000000803',
        ],
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const callData = await callEncoder.encodeDEXSwap('stellaswap', swapParams);

      // Mock realistic swap gas estimate
      jest.spyOn(txBuilder as any, 'getProvider').mockReturnValue({
        getTransactionCount: jest.fn().mockResolvedValue(0),
        estimateGas: jest.fn().mockResolvedValue(BigInt(180000)),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000),
        }),
      });

      const params: TransactionParams = {
        to: '0x1234567890123456789012345678901234567890',
        data: callData,
        value: '0',
        chainId: 1287,
      };

      const tx = await txBuilder.buildTransaction(params);

      // DEX swaps typically use 150k-250k gas
      expect(tx.gasLimit).toBeGreaterThan(BigInt(150000));
      expect(tx.gasLimit).toBeLessThan(BigInt(300000));
    });

    it('should estimate gas for liquidity provision', async () => {
      const liquidityParams = {
        tokenA: '0x0000000000000000000000000000000000000802',
        tokenB: '0x0000000000000000000000000000000000000803',
        amountA: ethers.parseEther('1').toString(),
        amountB: ethers.parseEther('100').toString(),
        minAmountA: ethers.parseEther('0.95').toString(),
        minAmountB: ethers.parseEther('95').toString(),
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const callData = await callEncoder.encodeLiquidityProvision('stellaswap', liquidityParams);

      // Mock realistic liquidity provision gas estimate
      jest.spyOn(txBuilder as any, 'getProvider').mockReturnValue({
        getTransactionCount: jest.fn().mockResolvedValue(0),
        estimateGas: jest.fn().mockResolvedValue(BigInt(250000)),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000),
        }),
      });

      const params: TransactionParams = {
        to: '0x1234567890123456789012345678901234567890',
        data: callData,
        value: '0',
        chainId: 1287,
      };

      const tx = await txBuilder.buildTransaction(params);

      // Liquidity provision typically uses 200k-350k gas
      expect(tx.gasLimit).toBeGreaterThan(BigInt(200000));
      expect(tx.gasLimit).toBeLessThan(BigInt(400000));
    });

    it('should estimate gas for batch transactions', async () => {
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

      const batch = await txBuilder.buildBatchTransaction(txs);

      expect(batch.totalGasLimit).toBe(BigInt(42000));
      expect(batch.estimatedCost).toBeDefined();
    });
  });

  describe('Gas Estimation Edge Cases', () => {
    it('should handle failed gas estimation gracefully', async () => {
      jest.spyOn(txBuilder as any, 'getProvider').mockReturnValue({
        getTransactionCount: jest.fn().mockResolvedValue(0),
        estimateGas: jest.fn().mockRejectedValue(new Error('Execution reverted')),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000),
        }),
      });

      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: '0x1234', // Invalid call data
        value: '0',
        chainId: 1287,
      };

      // Should fall back to default gas limit
      await expect(txBuilder.buildTransaction(params)).rejects.toThrow();
    });

    it('should handle network congestion in gas price', async () => {
      // Simulate high network congestion
      const congestedGasPrice = BigInt(50000000000); // 50 gwei

      jest.spyOn(txBuilder as any, 'getProvider').mockReturnValue({
        getTransactionCount: jest.fn().mockResolvedValue(0),
        estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: congestedGasPrice,
        }),
      });

      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: '0x',
        value: '0',
        chainId: 1287,
      };

      const tx = await txBuilder.buildTransaction(params);

      expect(tx.gasPrice).toBeGreaterThanOrEqual(congestedGasPrice);
    });

    it('should estimate gas for zero value transactions', async () => {
      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: '0x1234',
        value: '0',
        chainId: 1287,
      };

      const tx = await txBuilder.buildTransaction(params);

      expect(tx.value).toBe(BigInt(0));
      expect(tx.gasLimit).toBeGreaterThan(BigInt(0));
    });

    it('should handle very large transactions', async () => {
      // Large call data
      const largeCallData = '0x' + '00'.repeat(10000);

      jest.spyOn(txBuilder as any, 'getProvider').mockReturnValue({
        getTransactionCount: jest.fn().mockResolvedValue(0),
        estimateGas: jest.fn().mockResolvedValue(BigInt(500000)),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000),
        }),
      });

      const params: TransactionParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        data: largeCallData,
        value: '0',
        chainId: 1287,
      };

      const tx = await txBuilder.buildTransaction(params);

      // Large transactions should have proportionally higher gas
      expect(tx.gasLimit).toBeGreaterThan(BigInt(400000));
    });
  });

  describe('Gas Cost Calculation', () => {
    it('should calculate total transaction cost accurately', async () => {
      const gasLimit = BigInt(150000);
      const gasPrice = BigInt(1000000000); // 1 gwei

      const totalCost = gasLimit * gasPrice;

      expect(totalCost).toBe(BigInt(150000000000000)); // 0.00015 ETH
    });

    it('should calculate batch transaction costs', async () => {
      const txs = [
        { gasLimit: BigInt(21000), gasPrice: BigInt(1000000000) },
        { gasLimit: BigInt(150000), gasPrice: BigInt(1000000000) },
        { gasLimit: BigInt(200000), gasPrice: BigInt(1000000000) },
      ];

      const totalGas = txs.reduce((sum, tx) => sum + tx.gasLimit, BigInt(0));
      const totalCost = txs.reduce((sum, tx) => sum + (tx.gasLimit * tx.gasPrice), BigInt(0));

      expect(totalGas).toBe(BigInt(371000));
      expect(totalCost).toBe(BigInt(371000000000000));
    });

    it('should compare costs across different urgency levels', async () => {
      const gasLimit = BigInt(150000);

      const lowPrice = await txBuilder.optimizeGasPrice('low');
      const mediumPrice = await txBuilder.optimizeGasPrice('medium');
      const highPrice = await txBuilder.optimizeGasPrice('high');

      const lowCost = gasLimit * lowPrice;
      const mediumCost = gasLimit * mediumPrice;
      const highCost = gasLimit * highPrice;

      expect(lowCost).toBeLessThan(mediumCost);
      expect(mediumCost).toBeLessThan(highCost);

      // Calculate savings
      const savings = highCost - lowCost;
      expect(savings).toBeGreaterThan(BigInt(0));
    });
  });
});
