import { Injectable, Logger } from '@nestjs/common';
import { DatabaseProvider } from '../shared/database.provider';
import { IntentParams, Strategy } from '../shared/types';

export interface ChatMessage {
  id?: number;
  userAddress: string;
  messageType: 'user' | 'assistant';
  content: string;
  intentParams?: IntentParams;
  strategies?: Strategy[];
  confidence?: number;
  queryHash?: string;
  sessionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(private databaseProvider: DatabaseProvider) {}

  /**
   * Store a user message in the database
   */
  async storeUserMessage(
    userAddress: string,
    content: string,
    intentParams?: IntentParams,
    queryHash?: string,
    sessionId?: string,
  ): Promise<number> {
    try {
      const query = `
        INSERT INTO chat_messages (
          user_address, message_type, content, intent_params, 
          query_hash, session_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `;

      const values = [
        userAddress.toLowerCase(),
        'user',
        content,
        intentParams ? JSON.stringify(intentParams) : null,
        queryHash,
        sessionId,
      ];

      const result = await this.databaseProvider.query(query, values);
      const messageId = result.rows[0].id;

      this.logger.debug(`Stored user message ${messageId} for ${userAddress}`);
      return messageId;
    } catch (error) {
      this.logger.error('Failed to store user message:', error);
      throw error;
    }
  }

  /**
   * Store an assistant response in the database
   */
  async storeAssistantMessage(
    userAddress: string,
    content: string,
    strategies?: Strategy[],
    confidence?: number,
    queryHash?: string,
    sessionId?: string,
  ): Promise<number> {
    try {
      const query = `
        INSERT INTO chat_messages (
          user_address, message_type, content, strategies, 
          confidence, query_hash, session_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `;

      const values = [
        userAddress.toLowerCase(),
        'assistant',
        content,
        strategies ? JSON.stringify(strategies) : null,
        confidence,
        queryHash,
        sessionId,
      ];

      const result = await this.databaseProvider.query(query, values);
      const messageId = result.rows[0].id;

      this.logger.debug(`Stored assistant message ${messageId} for ${userAddress}`);
      return messageId;
    } catch (error) {
      this.logger.error('Failed to store assistant message:', error);
      throw error;
    }
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(
    userAddress: string,
    limit: number = 50,
    offset: number = 0,
    sessionId?: string,
  ): Promise<ChatMessage[]> {
    try {
      let query = `
        SELECT 
          id, user_address, message_type, content, intent_params,
          strategies, confidence, query_hash, session_id,
          created_at, updated_at
        FROM chat_messages 
        WHERE user_address = $1
      `;

      const values: any[] = [userAddress.toLowerCase()];

      if (sessionId) {
        query += ` AND session_id = $${values.length + 1}`;
        values.push(sessionId);
      }

      query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      values.push(limit, offset);

      const result = await this.databaseProvider.query(query, values);

      const messages: ChatMessage[] = result.rows.map((row: any) => ({
        id: row.id,
        userAddress: row.user_address,
        messageType: row.message_type,
        content: row.content,
        intentParams: row.intent_params ? (typeof row.intent_params === 'string' ? JSON.parse(row.intent_params) : row.intent_params) : undefined,
        strategies: row.strategies ? (typeof row.strategies === 'string' ? JSON.parse(row.strategies) : row.strategies) : undefined,
        confidence: row.confidence,
        queryHash: row.query_hash,
        sessionId: row.session_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      this.logger.debug(`Retrieved ${messages.length} messages for ${userAddress}`);
      return messages;
    } catch (error) {
      this.logger.error('Failed to get chat history:', error);
      throw error;
    }
  }

  /**
   * Get recent chat context for AI processing
   */
  async getRecentContext(
    userAddress: string,
    limit: number = 10,
    sessionId?: string,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    try {
      const messages = await this.getChatHistory(userAddress, limit, 0, sessionId);
      
      // Convert to OpenAI format and reverse to chronological order
      return messages
        .reverse()
        .map(msg => ({
          role: msg.messageType === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.content,
        }));
    } catch (error) {
      this.logger.error('Failed to get recent context:', error);
      return [];
    }
  }

  /**
   * Delete old chat messages (cleanup)
   */
  async deleteOldMessages(daysOld: number = 30): Promise<number> {
    try {
      const query = `
        DELETE FROM chat_messages 
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      `;

      const result = await this.databaseProvider.query(query);
      const deletedCount = result.rowCount || 0;

      this.logger.log(`Deleted ${deletedCount} old chat messages (older than ${daysOld} days)`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to delete old messages:', error);
      throw error;
    }
  }

  /**
   * Get chat statistics for a user
   */
  async getChatStats(userAddress: string): Promise<{
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    sessionsCount: number;
    firstMessageDate?: Date;
    lastMessageDate?: Date;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN message_type = 'user' THEN 1 END) as user_messages,
          COUNT(CASE WHEN message_type = 'assistant' THEN 1 END) as assistant_messages,
          COUNT(DISTINCT session_id) as sessions_count,
          MIN(created_at) as first_message_date,
          MAX(created_at) as last_message_date
        FROM chat_messages 
        WHERE user_address = $1
      `;

      const result = await this.databaseProvider.query(query, [userAddress.toLowerCase()]);
      const row = result.rows[0];

      return {
        totalMessages: parseInt(row.total_messages) || 0,
        userMessages: parseInt(row.user_messages) || 0,
        assistantMessages: parseInt(row.assistant_messages) || 0,
        sessionsCount: parseInt(row.sessions_count) || 0,
        firstMessageDate: row.first_message_date,
        lastMessageDate: row.last_message_date,
      };
    } catch (error) {
      this.logger.error('Failed to get chat stats:', error);
      throw error;
    }
  }

  /**
   * Generate a session ID for grouping related messages
   */
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}