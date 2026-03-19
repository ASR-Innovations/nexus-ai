/**
 * Unit tests for Fund Manager Service
 * Tests fund transfers, bridges, security controls, audit logging, and balance tracking
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
import { FundManagerService } from '../fund-manager.service';
import {
  TransferParams,
  BridgeParams,
} from '../interfaces/protocol-execution.interfaces';

describe('FundManagerService', () => {
  let service: FundManagerService;

  const testAddress1 = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
  const testAddress2 = '0x1234567890123456789012345678901234567890';
  const substrateAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FundManagerService],
    }).compile();

    service = module.get<FundManagerService>(FundManagerService);

    // Set initial balances for testing
    await service.setBalance(testAddress1, 'DOT', ethers.parseEther('100'));
    await service.setBalance(testAddress2, 'DOT', ethers.parseEther('50'));
  });

  describe('transferFunds', () => {
    it('should successfully transfer funds', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const result = await service.transferFunds(params);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(result.movementId).toBeDefined();
      expect(result.gasUsed).toBeDefined();
    });

    it('should update balances after transfer', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const initialBalance1 = await service.getBalance(testAddress1, 'DOT');
      const initialBalance2 = await service.getBalance(testAddress2, 'DOT');

      await service.transferFunds(params);

      const finalBalance1 = await service.getBalance(testAddress1, 'DOT');
      const finalBalance2 = await service.getBalance(testAddress2, 'DOT');

      expect(finalBalance1).toBe(initialBalance1 - ethers.parseEther('10'));
      expect(finalBalance2).toBe(initialBalance2 + ethers.parseEther('10'));
    });

    it('should reject transfer when paused', async () => {
      await service.pauseFundMovements();

      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const result = await service.transferFunds(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('paused');

      await service.resumeFundMovements();
    });

    it('should reject invalid addresses', async () => {
      const params: TransferParams = {
        from: 'invalid-address',
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const result = await service.transferFunds(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject zero amount', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: '0',
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const result = await service.transferFunds(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than zero');
    });
  });

  describe('bridgeFunds', () => {
    it('should successfully bridge funds', async () => {
      const params: BridgeParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('5').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
        destinationChain: 'hydration',
        destinationAddress: substrateAddress,
        xcmFee: ethers.parseEther('0.1').toString(),
      };

      const result = await service.bridgeFunds(params);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(result.movementId).toBeDefined();
      expect(result.xcmMessageId).toBeDefined();
      expect(result.estimatedDeliveryTime).toBeGreaterThan(0);
    });

    it('should reject bridge to same chain', async () => {
      const params: BridgeParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('5').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
        destinationChain: 'polkadot',
        destinationAddress: substrateAddress,
        xcmFee: ethers.parseEther('0.1').toString(),
      };

      const result = await service.bridgeFunds(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be different');
    });
  });

  describe('checkUserLimits', () => {
    it('should allow transfer within limits', async () => {
      const amount = ethers.parseEther('10');
      const limitCheck = await service.checkUserLimits(testAddress1, amount);

      expect(limitCheck.withinLimits).toBe(true);
      expect(limitCheck.limit).toBeDefined();
      expect(limitCheck.timeWindow).toBeDefined();
    });

    it('should reject transfer exceeding transaction limit', async () => {
      const amount = ethers.parseEther('100'); // Exceeds default transaction limit
      const limitCheck = await service.checkUserLimits(testAddress1, amount);

      expect(limitCheck.withinLimits).toBe(false);
      expect(limitCheck.timeWindow).toBe('per transaction');
    });

    it('should track daily usage', async () => {
      const amount1 = ethers.parseEther('30');
      const amount2 = ethers.parseEther('30');
      const amount3 = ethers.parseEther('50');

      const check1 = await service.checkUserLimits(testAddress1, amount1);
      expect(check1.withinLimits).toBe(true);

      // Simulate usage
      await service.transferFunds({
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: amount1.toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      });

      const check2 = await service.checkUserLimits(testAddress1, amount2);
      expect(check2.withinLimits).toBe(true);

      // Simulate more usage
      await service.transferFunds({
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: amount2.toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 2,
      });

      // This should exceed daily limit
      const check3 = await service.checkUserLimits(testAddress1, amount3);
      expect(check3.withinLimits).toBe(false);
      expect(check3.timeWindow).toBe('daily');
    });

    it('should allow custom user limits', async () => {
      const customDaily = ethers.parseEther('200');
      const customTransaction = ethers.parseEther('100');

      await service.setUserLimits(testAddress1, customDaily, customTransaction);

      const amount = ethers.parseEther('80');
      const limitCheck = await service.checkUserLimits(testAddress1, amount);

      expect(limitCheck.withinLimits).toBe(true);
    });
  });

  describe('validateTransfer', () => {
    it('should validate correct transfer parameters', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const validation = await service.validateTransfer(params);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid sender address', async () => {
      const params: TransferParams = {
        from: 'invalid',
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const validation = await service.validateTransfer(params);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid sender address');
    });

    it('should warn about same sender and recipient', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress1,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const validation = await service.validateTransfer(params);

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('same address');
    });
  });

  describe('getBalance', () => {
    it('should return correct balance', async () => {
      const balance = await service.getBalance(testAddress1, 'DOT');

      expect(balance).toBe(ethers.parseEther('100'));
    });

    it('should return zero for unknown address', async () => {
      const balance = await service.getBalance('0x9999999999999999999999999999999999999999', 'DOT');

      expect(balance).toBe(BigInt(0));
    });

    it('should return zero for unknown token', async () => {
      const balance = await service.getBalance(testAddress1, 'UNKNOWN');

      expect(balance).toBe(BigInt(0));
    });
  });

  describe('trackFundMovement', () => {
    it('should track fund movement by transaction hash', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      const result = await service.transferFunds(params);
      const status = await service.trackFundMovement(result.transactionHash!);

      expect(status.movementId).toBeDefined();
      expect(status.status).toBe('confirmed');
      expect(status.confirmations).toBeGreaterThan(0);
    });

    it('should return failed status for unknown transaction', async () => {
      const status = await service.trackFundMovement('0x0000000000000000000000000000000000000000000000000000000000000000');

      expect(status.status).toBe('failed');
    });
  });

  describe('pauseFundMovements and resumeFundMovements', () => {
    it('should pause and resume fund movements', async () => {
      await service.pauseFundMovements();
      
      const status1 = service.getSystemStatus();
      expect(status1.isPaused).toBe(true);

      await service.resumeFundMovements();
      
      const status2 = service.getSystemStatus();
      expect(status2.isPaused).toBe(false);
    });
  });

  describe('audit logging', () => {
    it('should log successful transfers', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      await service.transferFunds(params);

      const auditLog = service.getAuditLog({ userAddress: testAddress1 });
      expect(auditLog.length).toBeGreaterThan(0);
      
      const transferEntry = auditLog.find(entry => entry.action === 'transfer_funds');
      expect(transferEntry).toBeDefined();
      expect(transferEntry?.result).toBe('success');
    });

    it('should log failed transfers', async () => {
      const params: TransferParams = {
        from: 'invalid',
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      await service.transferFunds(params);

      const auditLog = service.getAuditLog({ userAddress: testAddress1 });
      const failedEntry = auditLog.find(entry => entry.result === 'failure');
      expect(failedEntry).toBeDefined();
    });

    it('should filter audit log by action', async () => {
      await service.pauseFundMovements();
      await service.resumeFundMovements();

      const pauseLog = service.getAuditLog({ action: 'pause_fund_movements' });
      expect(pauseLog.length).toBeGreaterThan(0);
      expect(pauseLog[0].action).toBe('pause_fund_movements');
    });
  });

  describe('getSystemStatus', () => {
    it('should return system status', async () => {
      const status = service.getSystemStatus();

      expect(status).toBeDefined();
      expect(status.isPaused).toBeDefined();
      expect(status.totalMovements).toBeGreaterThanOrEqual(0);
      expect(status.pendingMovements).toBeGreaterThanOrEqual(0);
      expect(status.totalAuditEntries).toBeGreaterThanOrEqual(0);
      expect(status.trackedAddresses).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMovementRecords', () => {
    it('should return all movement records', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      await service.transferFunds(params);

      const records = service.getMovementRecords();
      expect(records.length).toBeGreaterThan(0);
    });

    it('should filter records by status', async () => {
      const params: TransferParams = {
        from: testAddress1,
        to: testAddress2,
        token: 'DOT',
        amount: ethers.parseEther('10').toString(),
        chain: 'polkadot',
        userAddress: testAddress1,
        intentId: 1,
      };

      await service.transferFunds(params);

      const confirmedRecords = service.getMovementRecords({ status: 'confirmed' });
      expect(confirmedRecords.every(r => r.status === 'confirmed')).toBe(true);
    });
  });
});
