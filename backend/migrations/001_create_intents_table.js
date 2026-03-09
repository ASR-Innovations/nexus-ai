/**
 * Migration: Create intents table
 * Requirements: 14.3, 14.4
 */

exports.up = (pgm) => {
  pgm.createTable('intents', {
    id: {
      type: 'bigint',
      primaryKey: true,
      notNull: true,
    },
    user_address: {
      type: 'varchar(42)',
      notNull: true,
    },
    amount: {
      type: 'numeric(78, 0)',
      notNull: true,
    },
    goal_hash: {
      type: 'varchar(66)',
      notNull: true,
    },
    max_slippage_bps: {
      type: 'integer',
      notNull: true,
    },
    deadline: {
      type: 'bigint',
      notNull: true,
    },
    min_yield_bps: {
      type: 'integer',
    },
    max_lock_duration: {
      type: 'integer',
    },
    approved_protocols: {
      type: 'text[]',
    },
    natural_language_goal: {
      type: 'text',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'PENDING',
    },
    assigned_agent: {
      type: 'varchar(42)',
    },
    execution_plan_hash: {
      type: 'varchar(66)',
    },
    created_at: {
      type: 'bigint',
      notNull: true,
    },
    updated_at: {
      type: 'bigint',
      notNull: true,
    },
  });

  // Create indexes for performance
  pgm.createIndex('intents', 'user_address');
  pgm.createIndex('intents', 'status');
  pgm.createIndex('intents', 'assigned_agent');
  pgm.createIndex('intents', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('intents');
};