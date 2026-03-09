/**
 * Migration: Create agents table
 * Requirements: 14.4, 12.6
 */

exports.up = (pgm) => {
  pgm.createTable('agents', {
    address: {
      type: 'varchar(42)',
      primaryKey: true,
      notNull: true,
    },
    stake_amount: {
      type: 'numeric(78, 0)',
      notNull: true,
    },
    reputation_score: {
      type: 'integer',
      notNull: true,
      default: 5000,
    },
    success_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    fail_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    total_executions: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    metadata_uri: {
      type: 'text',
    },
    metadata_json: {
      type: 'jsonb',
    },
    registered_at: {
      type: 'bigint',
      notNull: true,
    },
    updated_at: {
      type: 'bigint',
      notNull: true,
    },
  });

  // Create indexes for performance
  pgm.createIndex('agents', ['reputation_score'], { order: 'DESC' });
  pgm.createIndex('agents', 'is_active');
  pgm.createIndex('agents', 'registered_at');
};

exports.down = (pgm) => {
  pgm.dropTable('agents');
};