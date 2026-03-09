/**
 * Migration: Create blocks table
 * Requirements: 14.9
 */

exports.up = (pgm) => {
  pgm.createTable('blocks', {
    block_number: {
      type: 'bigint',
      primaryKey: true,
      notNull: true,
    },
    block_hash: {
      type: 'varchar(66)',
      notNull: true,
    },
    timestamp: {
      type: 'bigint',
      notNull: true,
    },
    indexed_at: {
      type: 'bigint',
      notNull: true,
    },
  });

  // Create indexes for performance
  pgm.createIndex('blocks', 'timestamp');
  pgm.createIndex('blocks', 'indexed_at');
  pgm.createIndex('blocks', 'block_hash');
};

exports.down = (pgm) => {
  pgm.dropTable('blocks');
};