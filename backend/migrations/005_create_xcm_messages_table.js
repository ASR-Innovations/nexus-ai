/**
 * Migration: Create xcm_messages table
 * Requirements: 14.7
 */

exports.up = (pgm) => {
  pgm.createTable('xcm_messages', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    intent_id: {
      type: 'bigint',
      notNull: true,
      references: 'intents(id)',
      onDelete: 'CASCADE',
    },
    para_id: {
      type: 'integer',
      notNull: true,
    },
    xcm_message_hash: {
      type: 'varchar(66)',
      notNull: true,
    },
    xcm_message_bytes: {
      type: 'text',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'DISPATCHED',
    },
    dispatched_at: {
      type: 'bigint',
      notNull: true,
    },
    confirmed_at: {
      type: 'bigint',
    },
  });

  // Create indexes for performance
  pgm.createIndex('xcm_messages', 'intent_id');
  pgm.createIndex('xcm_messages', 'status');
  pgm.createIndex('xcm_messages', 'para_id');
  pgm.createIndex('xcm_messages', 'dispatched_at');
};

exports.down = (pgm) => {
  pgm.dropTable('xcm_messages');
};