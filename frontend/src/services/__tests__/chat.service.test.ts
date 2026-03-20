/**
 * Chat Service Tests
 * 
 * Unit tests for the ChatService class
 */

import { ChatService } from '../chat.service';
import { getApiClient } from '../api-client.service';
import { API_ENDPOINTS } from '@/lib/api-endpoints';

// Mock the API client
jest.mock('../api-client.service');

describe('ChatService', () => {
  let chatService: ChatService;
  let mockApiClient: any;

  beforeEach(() => {
    // Create mock API client
    mockApiClient = {
      post: jest.fn(),
      get: jest.fn(),
    };

    // Mock getApiClient to return our mock
    (getApiClient as jest.Mock).mockReturnValue(mockApiClient);

    // Create service instance
    chatService = new ChatService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message and return high confidence response with strategies', async () => {
      // Arrange
      const mockResponse = {
        data: {
          success: true,
          message: 'I found some yield strategies for your 100 DOT',
          intentParams: {
            action: 'yield',
            asset: 'DOT',
            amount: '100',
            riskTolerance: 'medium',
            minYieldBps: 500,
            maxLockDays: 30,
            deadline: 1710950764,
          },
          strategies: [
            {
              name: 'Hydration Liquidity Pool',
              protocol: 'Hydration',
              chain: 'hydration',
              apy: 16.85,
              risk: 'medium',
              lockPeriod: 0,
              estimatedGasUsd: 2.5,
              pros: ['High APY', 'No lock period'],
              cons: ['Impermanent loss risk'],
              explanation: 'Provide liquidity to DOT-USDT pool',
            },
          ],
          confidence: 85,
          conversationId: 'conv_123',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      // Act
      const result = await chatService.sendMessage({
        message: 'Get me yield on 100 DOT',
        userId: '0x1234567890abcdef',
        conversationId: 'conv_123',
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.CHAT_MESSAGE,
        {
          message: 'Get me yield on 100 DOT',
          userId: '0x1234567890abcdef',
          conversationId: 'conv_123',
        }
      );

      expect(result.success).toBe(true);
      expect(result.isHighConfidence).toBe(true);
      expect(result.confidence).toBe(85);
      expect(result.strategies).toHaveLength(1);
      expect(result.strategies![0].name).toBe('Hydration Liquidity Pool');
      expect(result.conversationId).toBe('conv_123');
    });

    it('should send message and return low confidence response with clarification', async () => {
      // Arrange
      const mockResponse = {
        data: {
          success: false,
          message: '',
          confidence: 45,
          clarificationQuestion: 'How much DOT would you like to use?',
          conversationId: 'conv_456',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      // Act
      const result = await chatService.sendMessage({
        message: 'I want yield',
        userId: '0x1234567890abcdef',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.isHighConfidence).toBe(false);
      expect(result.confidence).toBe(45);
      expect(result.clarificationQuestion).toBe('How much DOT would you like to use?');
      expect(result.conversationId).toBe('conv_456');
    });

    it('should handle conversation context with conversationId', async () => {
      // Arrange
      const mockResponse = {
        data: {
          success: true,
          message: 'Updated your preferences',
          confidence: 80,
          conversationId: 'conv_789',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      // Act
      await chatService.sendMessage({
        message: 'Make it low risk',
        userId: '0x1234567890abcdef',
        conversationId: 'conv_789',
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.CHAT_MESSAGE,
        expect.objectContaining({
          conversationId: 'conv_789',
        })
      );
    });
  });

  describe('createIntent', () => {
    it('should create intent and return unsigned transaction', async () => {
      // Arrange
      const mockResponse = {
        data: {
          success: true,
          intentId: 123,
          unsignedTx: {
            to: '0xE5dc120837acb51Bb7f613b60DC140df9de8d8ce',
            data: '0x1234567890abcdef',
            value: '0',
            gasLimit: '500000',
          },
          message: 'Please sign this transaction to create your intent',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const intentParams = {
        action: 'yield' as const,
        asset: 'DOT',
        amount: '100',
        riskTolerance: 'medium' as const,
        minYieldBps: 500,
        maxLockDays: 30,
        deadline: 1710950764,
      };

      const strategy = {
        name: 'Hydration Liquidity Pool',
        protocol: 'Hydration',
        chain: 'hydration',
        apy: 16.85,
        risk: 'medium' as const,
        lockPeriod: 0,
        estimatedGasUsd: 2.5,
        pros: ['High APY'],
        cons: ['Impermanent loss risk'],
        explanation: 'Provide liquidity',
      };

      // Act
      const result = await chatService.createIntent({
        userId: '0x1234567890abcdef',
        intentParams,
        selectedStrategy: strategy,
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.INTENT_CREATE,
        {
          userId: '0x1234567890abcdef',
          intentParams,
          selectedStrategy: strategy,
        }
      );

      expect(result.success).toBe(true);
      expect(result.intentId).toBe(123);
      expect(result.unsignedTx.to).toBe('0xE5dc120837acb51Bb7f613b60DC140df9de8d8ce');
    });
  });

  describe('approvePlan', () => {
    it('should approve plan and return unsigned transaction', async () => {
      // Arrange
      const mockResponse = {
        data: {
          success: true,
          unsignedTx: {
            to: '0xE5dc120837acb51Bb7f613b60DC140df9de8d8ce',
            data: '0xabcdef1234567890',
            value: '0',
            gasLimit: '300000',
          },
          message: 'Please sign this transaction to approve the execution plan',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      // Act
      const result = await chatService.approvePlan({
        intentId: 123,
        userId: '0x1234567890abcdef',
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.INTENT_APPROVE,
        {
          intentId: 123,
          userId: '0x1234567890abcdef',
        }
      );

      expect(result.success).toBe(true);
      expect(result.unsignedTx.gasLimit).toBe('300000');
    });
  });

  describe('executeIntent', () => {
    it('should execute intent and return unsigned transaction', async () => {
      // Arrange
      const mockResponse = {
        data: {
          success: true,
          unsignedTx: {
            to: '0x7dB4Cd6517b33f085ABb83B8c7E66F9A1A3393eE',
            data: '0xfedcba0987654321',
            value: '0',
            gasLimit: '800000',
          },
          message: 'Please sign this transaction to execute the intent',
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      // Act
      const result = await chatService.executeIntent({
        intentId: 123,
        userId: '0x1234567890abcdef',
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.INTENT_EXECUTE,
        {
          intentId: 123,
          userId: '0x1234567890abcdef',
        }
      );

      expect(result.success).toBe(true);
      expect(result.unsignedTx.gasLimit).toBe('800000');
    });
  });

  describe('getExecutionStatus', () => {
    it('should fetch execution status with steps and XCM messages', async () => {
      // Arrange
      const mockResponse = {
        data: {
          execution: {
            intent_id: 123,
            status: 'in_progress',
            total_steps: 3,
            completed_steps: 1,
            started_at: 1710864500,
            completed_at: null,
            error_message: null,
          },
          steps: [
            {
              id: 1,
              intent_id: 123,
              step_index: 0,
              destination_para_id: 2034,
              target_contract: '0xHydrationPool',
              status: 'completed',
              tx_hash: '0xabc123',
              executed_at: 1710864520,
            },
            {
              id: 2,
              intent_id: 123,
              step_index: 1,
              destination_para_id: 2034,
              target_contract: '0xHydrationPool',
              status: 'pending',
              tx_hash: null,
              executed_at: null,
            },
          ],
          xcmMessages: [
            {
              id: 1,
              intent_id: 123,
              para_id: 2034,
              xcm_message_hash: '0xdef456',
              status: 'confirmed',
              dispatched_at: 1710864510,
              confirmed_at: 1710864520,
            },
          ],
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      // Act
      const result = await chatService.getExecutionStatus(123);

      // Assert
      expect(mockApiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.EXECUTION_STATUS(123)
      );

      expect(result.execution.intent_id).toBe(123);
      expect(result.execution.status).toBe('in_progress');
      expect(result.steps).toHaveLength(2);
      expect(result.xcmMessages).toHaveLength(1);
    });
  });

  describe('getConversationHistory', () => {
    it('should fetch conversation history for user', async () => {
      // Arrange
      const mockResponse = {
        data: {
          success: true,
          memories: [
            {
              id: 'mem_123',
              userId: '0x1234567890abcdef',
              content: 'User prefers low-risk strategies',
              type: 'preference',
              timestamp: 1710864364205,
            },
          ],
          count: 1,
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      // Act
      const result = await chatService.getConversationHistory('0x1234567890abcdef');

      // Assert
      expect(mockApiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.CHAT_MEMORY('0x1234567890abcdef')
      );

      expect(result.success).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].content).toBe('User prefers low-risk strategies');
    });
  });
});
