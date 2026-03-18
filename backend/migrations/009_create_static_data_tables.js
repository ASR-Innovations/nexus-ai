/**
 * Migration: Create static data tables
 * Purpose: Store static reference data to reduce third-party API calls
 */

exports.up = (pgm) => {
  // Tokens table - static token information
  pgm.createTable('tokens', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    symbol: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    decimals: {
      type: 'integer',
      notNull: true,
      default: 18,
    },
    coingecko_id: {
      type: 'varchar(100)',
      comment: 'CoinGecko API ID for price fetching',
    },
    coincap_id: {
      type: 'varchar(100)',
      comment: 'CoinCap API ID for price fetching',
    },
    logo_url: {
      type: 'text',
      comment: 'Token logo image URL',
    },
    description: {
      type: 'text',
      comment: 'Token description',
    },
    website: {
      type: 'text',
      comment: 'Official website URL',
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  // Protocols table - DeFi protocol information
  pgm.createTable('protocols', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    chain: {
      type: 'varchar(50)',
      notNull: true,
    },
    category: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'dex, lending, staking, etc.',
    },
    website: {
      type: 'text',
    },
    logo_url: {
      type: 'text',
    },
    description: {
      type: 'text',
    },
    audit_status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'unaudited',
      comment: 'audited, partial, unaudited',
    },
    tvl_usd: {
      type: 'numeric(20, 2)',
      comment: 'Total Value Locked in USD (updated periodically)',
    },
    risk_level: {
      type: 'varchar(20)',
      notNull: true,
      default: 'medium',
      comment: 'low, medium, high',
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  // Chains table - blockchain network information
  pgm.createTable('chains', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    chain_id: {
      type: 'integer',
      comment: 'Chain ID for EVM chains',
    },
    para_id: {
      type: 'integer',
      comment: 'Parachain ID for Polkadot ecosystem',
    },
    rpc_url: {
      type: 'text',
      notNull: true,
    },
    ws_url: {
      type: 'text',
    },
    explorer_url: {
      type: 'text',
    },
    native_token: {
      type: 'varchar(20)',
      notNull: true,
    },
    logo_url: {
      type: 'text',
    },
    is_testnet: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  // Create indexes
  pgm.createIndex('tokens', 'symbol');
  pgm.createIndex('tokens', 'is_active');
  pgm.createIndex('protocols', 'chain');
  pgm.createIndex('protocols', 'category');
  pgm.createIndex('protocols', 'is_active');
  pgm.createIndex('chains', 'para_id');
  pgm.createIndex('chains', 'is_active');
};

exports.down = (pgm) => {
  pgm.dropTable('chains');
  pgm.dropTable('protocols');
  pgm.dropTable('tokens');
};