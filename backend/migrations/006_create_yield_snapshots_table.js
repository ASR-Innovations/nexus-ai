/**
 * Migration: Create yield_snapshots table
 * Requirements: 14.8
 */

exports.up = (pgm) => {
  pgm.createTable('yield_snapshots', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    protocol: {
      type: 'varchar(50)',
      notNull: true,
    },
    chain: {
      type: 'varchar(50)',
      notNull: true,
    },
    asset: {
      type: 'varchar(20)',
      notNull: true,
    },
    apy_bps: {
      type: 'integer',
      notNull: true,
    },
    tvl_usd: {
      type: 'numeric(20, 2)',
    },
    snapshot_at: {
      type: 'bigint',
      notNull: true,
    },
  });

  // Create indexes for performance
  pgm.createIndex('yield_snapshots', ['protocol', 'snapshot_at']);
  pgm.createIndex('yield_snapshots', ['asset', 'snapshot_at']);
  pgm.createIndex('yield_snapshots', 'snapshot_at');
};

exports.down = (pgm) => {
  pgm.dropTable('yield_snapshots');
};