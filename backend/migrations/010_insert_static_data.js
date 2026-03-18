/**
 * Migration: Insert initial static data
 * Purpose: Populate static reference tables with initial data
 */

exports.up = (pgm) => {
  // Insert tokens
  pgm.sql(`
    INSERT INTO tokens (symbol, name, decimals, coingecko_id, coincap_id, description) VALUES
    ('DOT', 'Polkadot', 10, 'polkadot', 'polkadot', 'Native token of the Polkadot network'),
    ('KSM', 'Kusama', 12, 'kusama', 'kusama', 'Native token of the Kusama network'),
    ('HDX', 'HydraDX', 12, 'hydradx', 'hydradx', 'Native token of HydraDX protocol'),
    ('BNC', 'Bifrost', 12, 'bifrost-native-coin', 'bifrost-native-coin', 'Native token of Bifrost protocol'),
    ('GLMR', 'Moonbeam', 18, 'moonbeam', 'moonbeam', 'Native token of Moonbeam network'),
    ('MOVR', 'Moonriver', 18, 'moonriver', 'moonriver', 'Native token of Moonriver network'),
    ('USDT', 'Tether USD', 6, 'tether', 'tether', 'USD-pegged stablecoin'),
    ('USDC', 'USD Coin', 6, 'usd-coin', 'usd-coin', 'USD-pegged stablecoin'),
    ('ETH', 'Ethereum', 18, 'ethereum', 'ethereum', 'Native token of Ethereum network'),
    ('BTC', 'Bitcoin', 8, 'bitcoin', 'bitcoin', 'The first cryptocurrency')
    ON CONFLICT (symbol) DO NOTHING;
  `);

  // Insert chains
  pgm.sql(`
    INSERT INTO chains (name, para_id, rpc_url, ws_url, native_token, is_testnet) VALUES
    ('Polkadot Asset Hub', 1000, 'https://polkadot-asset-hub-rpc.polkadot.io', 'wss://polkadot-asset-hub-rpc.polkadot.io', 'DOT', false),
    ('Hydration', 2034, 'https://rpc.hydradx.cloud', 'wss://rpc.hydradx.cloud', 'HDX', false),
    ('Bifrost', 2030, 'https://hk.p.bifrost-rpc.liebi.com/ws', 'wss://bifrost-polkadot.api.onfinality.io/public-ws', 'BNC', false),
    ('Moonbeam', 2004, 'https://rpc.api.moonbeam.network', 'wss://wss.api.moonbeam.network', 'GLMR', false),
    ('Moonriver', 2023, 'https://rpc.api.moonriver.moonbeam.network', 'wss://wss.api.moonriver.moonbeam.network', 'MOVR', false)
    ON CONFLICT (name) DO NOTHING;
  `);

  // Insert protocols
  pgm.sql(`
    INSERT INTO protocols (name, chain, category, audit_status, risk_level, description) VALUES
    ('Hydration Omnipool', 'Hydration', 'dex', 'audited', 'medium', 'Omnipool AMM for efficient trading'),
    ('Bifrost Liquid Staking', 'Bifrost', 'staking', 'audited', 'low', 'Liquid staking for DOT and other assets'),
    ('StellaSwap', 'Moonbeam', 'dex', 'partial', 'medium', 'DEX and yield farming on Moonbeam'),
    ('Moonwell', 'Moonbeam', 'lending', 'audited', 'medium', 'Lending and borrowing protocol'),
    ('Beamswap', 'Moonbeam', 'dex', 'partial', 'medium', 'AMM DEX on Moonbeam')
    ON CONFLICT (name) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DELETE FROM protocols');
  pgm.sql('DELETE FROM chains');
  pgm.sql('DELETE FROM tokens');
};