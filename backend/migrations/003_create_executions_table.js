/**
 * Migration: Create executions table
 * Requirements: 14.5
 */

exports.up = (pgm) => {
  pgm.createTable('executions', {
    intent_id: {
      type: 'bigint',
      primaryKey: true,
      notNull: true,
      references: 'intents(id)',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'IN_PROGRESS',
    },
    total_steps: {
      type: 'integer',
      notNull: true,
    },
    completed_steps: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    started_at: {
      type: 'bigint',
      notNull: true,
    },
    completed_at: {
      type: 'bigint',
    },
    error_message: {
      type: 'text',
    },
  });

  // Create indexes for performance
  pgm.createIndex('executions', 'status');
  pgm.createIndex('executions', 'started_at');
};

exports.down = (pgm) => {
  pgm.dropTable('executions');
};