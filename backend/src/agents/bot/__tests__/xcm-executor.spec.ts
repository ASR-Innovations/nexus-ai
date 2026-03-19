/**
 * Unit tests for XCM Executor Service
 * Tests message construction, execution, tracking, and error handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { XCMExecutorService } from '../xcm-executor.service';
import {
  XCMTransferParams,
  RemoteExecutionParams,
  XCMFeeParams,
} from '../interfaces/protocol-execution.interfaces';

describe('XCMExecutorService', () => {
  let service: XCMExecutorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XCMExecutorService],
    }).compile();

    service = module.get<XCMExecutorService>(XCMExecutorService);
  });

  afterEach(async () => {
    // Cleanup
    await service.onModuleDestroy();
  });

  describe('buildTransferMessage', () => {
    it('should build a valid XCM transfer message', async () => {
      const params: XCMTransferParams = {
        fromChain: 'polkadot',
        toChain: 'hydration',
        asset: 'DOT',
        amount: '1000000000000', // 1 DOT
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000', // 0.1 DOT
      };

      const message = await service.buildTransferMessage(params);

      expect(message).toBeDefined();
      expect(message.version).toBe(3);
      expect(message.destination).toBeDefined();
      expect(message.destination.parents).toBe(1);
      expect(message.message).toHaveLength(3); // withdraw, buyExecution, deposit
      expect(message.messageId).toBeDefined();
      expect(message.sender).toBe(params.sender);
      expect(message.recipient).toBe(params.recipient);
      expect(message.fee).toBe(BigInt(params.fee));
    });

    it('should handle Ethereum-style addresses', async () => {
      const params: XCMTransferParams = {
        fromChain: 'polkadot',
        toChain: 'moonbeam',
        asset: 'DOT',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '0x1234567890123456789012345678901234567890',
        fee: '100000000000',
      };

      const message = await service.buildTransferMessage(params);

      expect(message).toBeDefined();
      expect(message.recipient).toBe(params.recipient);
    });

    it('should reject invalid parameters', async () => {
      const params: XCMTransferParams = {
        fromChain: 'polkadot',
        toChain: 'polkadot', // Same chain
        asset: 'DOT',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      await expect(service.buildTransferMessage(params)).rejects.toThrow();
    });

    it('should reject zero amount', async () => {
      const params: XCMTransferParams = {
        fromChain: 'polkadot',
        toChain: 'hydration',
        asset: 'DOT',
        amount: '0',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      await expect(service.buildTransferMessage(params)).rejects.toThrow();
    });
  });

  describe('buildRemoteExecutionMessage', () => {
    it('should build a valid remote execution message', async () => {
      const params: RemoteExecutionParams = {
        targetChain: 'moonbeam',
        contractAddress: '0x1234567890123456789012345678901234567890',
        callData: '0xabcdef',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '200000000000',
        weight: {
          refTime: BigInt(5000000000),
          proofSize: BigInt(128000),
        },
      };

      const message = await service.buildRemoteExecutionMessage(params);

      expect(message).toBeDefined();
      expect(message.version).toBe(3);
      expect(message.destination).toBeDefined();
      expect(message.weight).toEqual(params.weight);
      expect(message.recipient).toBe(params.contractAddress);
    });

    it('should reject unknown target chain', async () => {
      const params: RemoteExecutionParams = {
        targetChain: 'unknown-chain',
        contractAddress: '0x1234567890123456789012345678901234567890',
        callData: '0xabcdef',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '200000000000',
        weight: {
          refTime: BigInt(5000000000),
          proofSize: BigInt(128000),
        },
      };

      await expect(service.buildRemoteExecutionMessage(params)).rejects.toThrow();
    });
  });

  describe('sendXCMMessage', () => {
    it('should send a valid XCM message', async () => {
      const params: XCMTransferParams = {
        fromChain: 'polkadot',
        toChain: 'hydration',
        asset: 'DOT',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      const message = await service.buildTransferMessage(params);
      const result = await service.sendXCMMessage(message);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(message.messageId);
      expect(result.transactionHash).toBeDefined();
    });

    it('should handle invalid messages', async () => {
      const invalidMessage: any = {
        version: 3,
        destination: null,
        message: [],
        weight: { refTime: BigInt(0), proofSize: BigInt(0) },
        fee: BigInt(0),
        messageId: 'test',
        sender: '',
        recipient: '',
      };

      const result = await service.sendXCMMessage(invalidMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('trackMessageDelivery', () => {
    it('should track message delivery status', async () => {
      const params: XCMTransferParams = {
        fromChain: 'polkadot',
        toChain: 'hydration',
        asset: 'DOT',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      const message = await service.buildTransferMessage(params);
      await service.sendXCMMessage(message);

      const status = await service.trackMessageDelivery(message.messageId);

      expect(status).toBeDefined();
      expect(status.messageId).toBe(message.messageId);
      expect(status.status).toBeDefined();
      expect(['pending', 'delivered', 'failed', 'timeout']).toContain(status.status);
    });

    it('should return error for unknown message', async () => {
      const status = await service.trackMessageDelivery('unknown-message-id');

      expect(status.status).toBe('failed');
      expect(status.error).toBeDefined();
    });
  });

  describe('calculateXCMFee', () => {
    it('should calculate XCM transfer fee', async () => {
      const params: XCMFeeParams = {
        fromChain: 'polkadot',
        toChain: 'hydration',
        asset: 'DOT',
        amount: '1000000000000',
      };

      const feeEstimate = await service.calculateXCMFee(params);

      expect(feeEstimate).toBeDefined();
      expect(feeEstimate.fee).toBeDefined();
      expect(BigInt(feeEstimate.fee)).toBeGreaterThan(BigInt(0));
      expect(feeEstimate.currency).toBeDefined();
      expect(feeEstimate.estimatedTime).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(feeEstimate.confidence);
    });

    it('should handle invalid chain configurations', async () => {
      const params: XCMFeeParams = {
        fromChain: 'unknown',
        toChain: 'hydration',
        asset: 'DOT',
        amount: '1000000000000',
      };

      const feeEstimate = await service.calculateXCMFee(params);

      // Should return conservative estimate
      expect(feeEstimate).toBeDefined();
      expect(feeEstimate.confidence).toBe('low');
    });
  });

  describe('validateXCMMessage', () => {
    it('should validate a correct XCM message', async () => {
      const params: XCMTransferParams = {
        fromChain: 'polkadot',
        toChain: 'hydration',
        asset: 'DOT',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      const message = await service.buildTransferMessage(params);
      const validation = await service.validateXCMMessage(message);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid version', async () => {
      const invalidMessage: any = {
        version: 99,
        destination: { parents: 1, interior: { x1: { parachain: 2034 } } },
        message: [{ withdrawAsset: [] }],
        weight: { refTime: BigInt(1000), proofSize: BigInt(1000) },
        fee: BigInt(100),
        messageId: 'test',
        sender: 'sender',
        recipient: 'recipient',
      };

      const validation = await service.validateXCMMessage(invalidMessage);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing instructions', async () => {
      const invalidMessage: any = {
        version: 3,
        destination: { parents: 1, interior: { x1: { parachain: 2034 } } },
        message: [],
        weight: { refTime: BigInt(1000), proofSize: BigInt(1000) },
        fee: BigInt(100),
        messageId: 'test',
        sender: 'sender',
        recipient: 'recipient',
      };

      const validation = await service.validateXCMMessage(invalidMessage);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('No XCM instructions provided');
    });
  });

  describe('retryFailedMessage', () => {
    it('should retry a failed message', async () => {
      const params: XCMTransferParams = {
        fromChain: 'polkadot',
        toChain: 'hydration',
        asset: 'DOT',
        amount: '1000000000000',
        sender: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fee: '100000000000',
      };

      const message = await service.buildTransferMessage(params);
      
      // Simulate a failed message by sending invalid message
      const invalidMessage: any = {
        ...message,
        destination: null,
      };
      
      await service.sendXCMMessage(invalidMessage);

      // Retry should eventually succeed or fail gracefully
      const result = await service.retryFailedMessage(invalidMessage.messageId);

      expect(result).toBeDefined();
      expect(result.messageId).toBe(invalidMessage.messageId);
    }, 30000); // Longer timeout for retry logic

    it('should reject retry for non-existent message', async () => {
      await expect(service.retryFailedMessage('non-existent')).rejects.toThrow('Message not found');
    });
  });
});
