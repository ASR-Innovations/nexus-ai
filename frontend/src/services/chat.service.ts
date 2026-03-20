/**
 * Chat Service
 * 
 * Handles natural language message processing, intent creation, and execution tracking.
 * 
 * Features:
 * - Send chat messages and receive AI responses
 * - Handle high confidence responses (>70%) with strategies
 * - Handle low confidence responses (<70%) with clarification questions
 * - Maintain conversation context with conversationId
 * - Create intents from strategy selections
 * - Approve execution plans
 * - Execute intents
 * - Track execution status
 */

import { getApiClient } from './api-client.service';
import { API_ENDPOINTS } from '@/lib/api-endpoints';
import type {
  ChatMessageRequest,
  ChatMessageResponse,
  CreateIntentRequest,
  CreateIntentResponse,
  ApproveIntentRequest,
  ApproveIntentResponse,
  ExecuteIntentRequest,
  ExecuteIntentResponse,
  ExecutionStatusResponse,
  GetMemoryResponse,
} from '@/types/api.types';
import type { IntentParams, Strategy } from '@/types';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SendMessageOptions {
  message: string;
  userId: string;
  conversationId?: string;
}

export interface SendMessageResult {
  success: boolean;
  message: string;
  intentParams?: IntentParams;
  strategies?: Strategy[];
  confidence: number;
  conversationId: string;
  clarificationQuestion?: string;
  isHighConfidence: boolean;
}

export interface CreateIntentOptions {
  userId: string;
  intentParams: IntentParams;
  selectedStrategy: Strategy;
}

export interface ApproveIntentOptions {
  intentId: number;
  userId: string;
}

export interface ExecuteIntentOptions {
  intentId: number;
  userId: string;
}

// ============================================================================
// Chat Service Class
// ============================================================================

export class ChatService {
  private get apiClient() {
    return getApiClient();
  }

  /**
   * Send a chat message and receive AI response
   * 
   * Handles both high confidence (>70%) and low confidence (<70%) responses:
   * - High confidence: Returns strategies for user to choose from
   * - Low confidence: Returns clarification question for more context
   * 
   * @param options - Message options including text, userId, and optional conversationId
   * @returns Promise with chat response including strategies or clarification
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const { message, userId, conversationId } = options;

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Message is required and must be a non-empty string');
    }

    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      throw new Error('User ID is required and must be a valid string');
    }

    // Validate Ethereum address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(userId)) {
      throw new Error('User ID must be a valid Ethereum address');
    }

    console.log('[Chat Service] Sending message:', { message, userId, conversationId });

    const request: ChatMessageRequest = {
      message: message.trim(),
      userId: userId.toLowerCase(), // Normalize to lowercase
      conversationId: conversationId || undefined, // Ensure it's undefined if empty
    };

    console.log('[Chat Service] Request payload:', request);
    console.log('[Chat Service] API endpoint:', API_ENDPOINTS.CHAT_MESSAGE);

    try {
      const response = await this.apiClient.post<ChatMessageResponse>(
        API_ENDPOINTS.CHAT_MESSAGE,
        request
      );

      console.log('[Chat Service] Response received:', response);

      const data = response.data;

      // Determine if this is a high confidence response
      const isHighConfidence = (data.confidence ?? 0) > 70;

      return {
        success: data.success,
        message: data.message || data.clarificationQuestion || 'I need more information to help you.',
        intentParams: data.intentParams,
        strategies: data.strategies,
        confidence: data.confidence ?? 0,
        conversationId: data.conversationId || '',
        clarificationQuestion: data.clarificationQuestion,
        isHighConfidence,
      };
    } catch (error) {
      console.error('[Chat Service] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Create an intent from a selected strategy
   * 
   * Returns an unsigned transaction that must be signed by the user's wallet
   * 
   * @param options - Intent creation options including userId, intentParams, and selectedStrategy
   * @returns Promise with intentId and unsigned transaction
   */
  async createIntent(options: CreateIntentOptions): Promise<CreateIntentResponse> {
    const { userId, intentParams, selectedStrategy } = options;

    const request: CreateIntentRequest = {
      userId,
      intentParams,
      selectedStrategy,
    };

    const response = await this.apiClient.post<CreateIntentResponse>(
      API_ENDPOINTS.INTENT_CREATE,
      request
    );

    return response.data;
  }

  /**
   * Approve an execution plan for an intent
   * 
   * Returns an unsigned transaction that must be signed by the user's wallet
   * 
   * @param options - Approval options including intentId and userId
   * @returns Promise with unsigned transaction
   */
  async approvePlan(options: ApproveIntentOptions): Promise<ApproveIntentResponse> {
    const { intentId, userId } = options;

    const request: ApproveIntentRequest = {
      intentId,
      userId,
    };

    const response = await this.apiClient.post<ApproveIntentResponse>(
      API_ENDPOINTS.INTENT_APPROVE,
      request
    );

    return response.data;
  }

  /**
   * Execute an approved intent
   * 
   * Returns an unsigned transaction that must be signed by the user's wallet
   * 
   * @param options - Execution options including intentId and userId
   * @returns Promise with unsigned transaction
   */
  async executeIntent(options: ExecuteIntentOptions): Promise<ExecuteIntentResponse> {
    const { intentId, userId } = options;

    const request: ExecuteIntentRequest = {
      intentId,
      userId,
    };

    const response = await this.apiClient.post<ExecuteIntentResponse>(
      API_ENDPOINTS.INTENT_EXECUTE,
      request
    );

    return response.data;
  }

  /**
   * Get execution status for an intent
   * 
   * Used for polling execution progress. Should be called every 5 seconds
   * until execution completes or fails.
   * 
   * @param intentId - The intent ID to check status for
   * @returns Promise with execution status including steps and XCM messages
   */
  async getExecutionStatus(intentId: number): Promise<ExecutionStatusResponse> {
    const response = await this.apiClient.get<ExecutionStatusResponse>(
      API_ENDPOINTS.EXECUTION_STATUS(intentId)
    );

    return response.data;
  }

  /**
   * Get conversation history for a user
   * 
   * Retrieves stored memories and conversation context
   * 
   * @param userId - The user ID to get history for
   * @returns Promise with conversation memories
   */
  async getConversationHistory(userId: string): Promise<GetMemoryResponse> {
    const response = await this.apiClient.get<GetMemoryResponse>(
      API_ENDPOINTS.CHAT_MEMORY(userId)
    );

    return response.data;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let chatServiceInstance: ChatService | null = null;

/**
 * Create a new ChatService instance
 * 
 * @returns ChatService instance
 */
export function createChatService(): ChatService {
  chatServiceInstance = new ChatService();
  return chatServiceInstance;
}

/**
 * Get the singleton ChatService instance
 * 
 * @returns ChatService instance
 * @throws Error if service not initialized
 */
export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}
