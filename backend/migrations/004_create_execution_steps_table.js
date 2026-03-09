/**
 * Migration: Create execution_steps table
 * Requirements: 14.6
 */

exports.up = (pgm) => {
  pgm.createTable('execution_steps', {
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
    step_index: {
      type: 'integer',
      notNull: true,
    },
    destination_para_id: {
      type: 'integer',
      notNull: true,
    },
    target_contract: {
      type: 'varchar(42)',
    },
    call_data: {
      type: 'text',
    },
    value: {
      type: 'numeric(78, 0)',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'PENDING',
    },
    tx_hash: {
      type: 'varchar(66)',
    },
    executed_at: {
      type: 'bigint',
    },
  });

  // Create unique constraint and indexes
  pgm.addConstraint('execution_steps', 'unique_intent_step', {
    unique: ['intent_id', 'step_index'],
  });
  
  pgm.createIndex('execution_steps', 'intent_id');
  pgm.createIndex('execution_steps', 'status');
  pgm.createIndex('execution_steps', 'destination_para_id');
};

exports.down = (pgm) => {
  pgm.dropTable('execution_steps');
};