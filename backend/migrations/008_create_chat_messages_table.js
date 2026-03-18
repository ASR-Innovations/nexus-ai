/**
 * Migration: Create chat_messages table
 * Purpose: Store user chat messages and AI responses for history
 */

exports.up = (pgm) => {
  pgm.createTable('chat_messages', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    user_address: {
      type: 'varchar(42)',
      notNull: true,
    },
    message_type: {
      type: 'varchar(20)',
      notNull: true,
      comment: 'user or assistant',
    },
    content: {
      type: 'text',
      notNull: true,
    },
    intent_params: {
      type: 'jsonb',
      comment: 'Parsed intent parameters (for user messages)',
    },
    strategies: {
      type: 'jsonb',
      comment: 'Strategy recommendations (for assistant messages)',
    },
    confidence: {
      type: 'integer',
      comment: 'AI confidence score (0-100)',
    },
    query_hash: {
      type: 'varchar(64)',
      comment: 'Hash of the query for deduplication',
    },
    session_id: {
      type: 'varchar(64)',
      comment: 'Session identifier for grouping messages',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: 'now()',
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: 'now()',
    },
  });

  // Create indexes for performance
  pgm.createIndex('chat_messages', 'user_address');
  pgm.createIndex('chat_messages', 'message_type');
  pgm.createIndex('chat_messages', 'session_id');
  pgm.createIndex('chat_messages', 'created_at');
  pgm.createIndex('chat_messages', 'query_hash');
  
  // Create composite index for user chat history
  pgm.createIndex('chat_messages', ['user_address', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('chat_messages');
};