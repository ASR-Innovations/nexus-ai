import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  HOST: z.string().default('localhost'),
  API_BASE_URL: z.string().url(),

  // Database Configuration
  DATABASE_URL: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().min(1).max(65535),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.coerce.boolean().default(false),
  DB_POOL_MIN: z.coerce.number().min(1).default(2),
  DB_POOL_MAX: z.coerce.number().min(1).default(10),

  // Redis Configuration
  REDIS_URL: z.string().min(1),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().min(1).max(65535),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().min(0).default(0),
  REDIS_TTL_SECONDS: z.coerce.number().min(1).default(120),

  // Blockchain Configuration
  POLKADOT_HUB_RPC_URL: z.string().url(),
  POLKADOT_HUB_WS_URL: z.string().min(1),
  HYDRATION_RPC_URL: z.string().min(1),
  BIFROST_RPC_URL: z.string().min(1),
  MOONBEAM_RPC_URL: z.string().min(1),

  // Contract Addresses
  INTENT_VAULT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  AGENT_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  EXECUTION_MANAGER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),

  // AI Services Configuration
  DEEPSEEK_API_KEY: z.string().min(1),
  DEEPSEEK_BASE_URL: z.string().url(),
  DEEPSEEK_MODEL_CHAT: z.string().default('deepseek-chat'),
  DEEPSEEK_MODEL_REASONER: z.string().default('deepseek-reasoner'),
  DEEPSEEK_MAX_TOKENS: z.coerce.number().min(1).default(4000),
  DEEPSEEK_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),

  // Memory Service Configuration
  MEM0_API_KEY: z.string().min(1),
  MEM0_BASE_URL: z.string().url(),
  MEM0_USER_ID_PREFIX: z.string().default('nexus-ai-v1'),
  MEM0_AGENT_ID: z.string().default('nexus-ai-v1'),

  // External APIs
  COINGECKO_API_URL: z.string().url().default('https://api.coingecko.com/api/v3'),
  COINGECKO_API_KEY: z.string().optional(),

  // Rate Limiting Configuration
  RATE_LIMIT_CHAT_PER_MINUTE: z.coerce.number().min(1).default(30),
  RATE_LIMIT_INTENT_PER_MINUTE: z.coerce.number().min(1).default(5),
  RATE_LIMIT_PORTFOLIO_PER_MINUTE: z.coerce.number().min(1).default(20),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(60000),

  // Caching Configuration
  CACHE_YIELD_DATA_TTL: z.coerce.number().min(1).default(120),
  CACHE_PORTFOLIO_TTL: z.coerce.number().min(1).default(30),
  CACHE_DEEPSEEK_TTL: z.coerce.number().min(1).default(60),
  CACHE_AGENT_METADATA_TTL: z.coerce.number().min(1).default(300),

  // Indexer Configuration
  INDEXER_START_BLOCK: z.union([z.literal('latest'), z.coerce.number().min(0)]).default('latest'),
  INDEXER_BATCH_SIZE: z.coerce.number().min(1).default(100),
  INDEXER_REORG_DEPTH: z.coerce.number().min(1).default(10),
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().min(1000).default(5000),
  INDEXER_XCM_CONFIRMATION_TIMEOUT: z.coerce.number().min(1000).default(300000),

  // WebSocket Configuration
  WS_PORT: z.coerce.number().min(1).max(65535).default(3001),
  WS_HEARTBEAT_INTERVAL: z.coerce.number().min(1000).default(30000),
  WS_MAX_CONNECTIONS: z.coerce.number().min(1).default(1000),

  // Security Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  CORS_ORIGINS: z.string().min(1),
  SIGNATURE_TIMEOUT_MS: z.coerce.number().min(1000).default(300000),

  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
  LOG_FILE_PATH: z.string().optional(),
  LOG_MAX_FILES: z.coerce.number().min(1).default(7),
  LOG_MAX_SIZE: z.string().default('10m'),

  // Monitoring Configuration
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_TIMEOUT: z.coerce.number().min(1000).default(5000),

  // Gas Estimation Configuration
  GAS_ESTIMATION_BUFFER_PERCENT: z.coerce.number().min(0).max(100).default(20),
  GAS_PRICE_ORACLE_URL: z.string().url().optional(),
  DEFAULT_GAS_LIMIT: z.coerce.number().min(21000).default(500000),

  // Yield Aggregator Configuration
  YIELD_REFRESH_INTERVAL_NATIVE: z.coerce.number().min(1000).default(60000),
  YIELD_REFRESH_INTERVAL_PARACHAIN: z.coerce.number().min(1000).default(120000),
  YIELD_SNAPSHOT_INTERVAL: z.coerce.number().min(1000).default(600000),
  YIELD_CACHE_FALLBACK_ENABLED: z.coerce.boolean().default(true),

  // Strategy Engine Configuration
  STRATEGY_MAX_RESULTS: z.coerce.number().min(1).default(3),
  STRATEGY_RISK_WEIGHTS_CONTRACT: z.coerce.number().min(0).max(1).default(0.3),
  STRATEGY_RISK_WEIGHTS_IL: z.coerce.number().min(0).max(1).default(0.2),
  STRATEGY_RISK_WEIGHTS_LOCK: z.coerce.number().min(0).max(1).default(0.2),
  STRATEGY_RISK_WEIGHTS_TVL: z.coerce.number().min(0).max(1).default(0.15),
  STRATEGY_RISK_WEIGHTS_VOLATILITY: z.coerce.number().min(0).max(1).default(0.15),

  // Agent Bot Configuration
  AGENT_BOT_ENABLED: z.coerce.boolean().default(false),
  AGENT_BOT_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format').optional(),
  AGENT_BOT_STAKE_AMOUNT: z.coerce.number().min(0).default(10.0),
  AGENT_BOT_MAX_ACTIVE_INTENTS: z.coerce.number().min(1).default(5),
  AGENT_BOT_MIN_REPUTATION: z.coerce.number().min(0).default(3000),
  AGENT_BOT_AUTO_EXECUTE: z.coerce.boolean().default(true),
  AGENT_BOT_RISK_TOLERANCE: z.enum(['low', 'medium', 'high']).default('medium'),
  AGENT_BOT_SPECIALTIES: z.string().default('yield-farming,liquid-staking'),

  // Development Configuration
  DEBUG_ENABLED: z.coerce.boolean().default(false),
  MOCK_EXTERNAL_APIS: z.coerce.boolean().default(false),
  SKIP_SIGNATURE_VERIFICATION: z.coerce.boolean().default(false),
  ENABLE_API_DOCS: z.coerce.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnvironment(): EnvConfig {
  try {
    const config = envSchema.parse(process.env);
    
    // Additional validation logic
    validateRiskWeights(config);
    validateContractAddresses(config);
    validateBotConfiguration(config);
    
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
        .map(err => err.path.join('.'));
      
      const invalidVars = error.errors
        .filter(err => err.code !== 'invalid_type' || err.received !== 'undefined')
        .map(err => `${err.path.join('.')}: ${err.message}`);
      
      let errorMessage = 'Environment validation failed:\n';
      
      if (missingVars.length > 0) {
        errorMessage += `\nMissing required environment variables:\n${missingVars.map(v => `  - ${v}`).join('\n')}`;
      }
      
      if (invalidVars.length > 0) {
        errorMessage += `\nInvalid environment variables:\n${invalidVars.map(v => `  - ${v}`).join('\n')}`;
      }
      
      errorMessage += '\n\nPlease check your .env file and ensure all required variables are set correctly.';
      errorMessage += '\nRefer to .env.example for the complete list of required variables.';
      
      console.error(errorMessage);
      process.exit(1);
    }
    
    console.error('Unexpected error during environment validation:', error);
    process.exit(1);
  }
}

function validateRiskWeights(config: EnvConfig): void {
  const totalWeight = 
    config.STRATEGY_RISK_WEIGHTS_CONTRACT +
    config.STRATEGY_RISK_WEIGHTS_IL +
    config.STRATEGY_RISK_WEIGHTS_LOCK +
    config.STRATEGY_RISK_WEIGHTS_TVL +
    config.STRATEGY_RISK_WEIGHTS_VOLATILITY;
  
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    console.error(`Risk weights must sum to 1.0, got ${totalWeight}`);
    console.error('Check STRATEGY_RISK_WEIGHTS_* environment variables');
    process.exit(1);
  }
}

function validateContractAddresses(config: EnvConfig): void {
  const addresses = [
    config.INTENT_VAULT_ADDRESS,
    config.AGENT_REGISTRY_ADDRESS,
    config.EXECUTION_MANAGER_ADDRESS,
  ];
  
  // Check for zero addresses in production
  if (config.NODE_ENV === 'production') {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const hasZeroAddress = addresses.some(addr => addr === zeroAddress);
    
    if (hasZeroAddress) {
      console.error('Contract addresses cannot be zero address in production');
      console.error('Please deploy contracts and update environment variables');
      process.exit(1);
    }
  }
  
  // Check for duplicate addresses
  const uniqueAddresses = new Set(addresses);
  if (uniqueAddresses.size !== addresses.length) {
    console.error('Contract addresses must be unique');
    console.error('Check INTENT_VAULT_ADDRESS, AGENT_REGISTRY_ADDRESS, and EXECUTION_MANAGER_ADDRESS');
    process.exit(1);
  }
}

function validateBotConfiguration(config: EnvConfig): void {
  // If bot is enabled, private key is required
  if (config.AGENT_BOT_ENABLED && !config.AGENT_BOT_PRIVATE_KEY) {
    console.error('AGENT_BOT_PRIVATE_KEY is required when AGENT_BOT_ENABLED=true');
    process.exit(1);
  }
  
  // Validate specialties format
  if (config.AGENT_BOT_SPECIALTIES) {
    const validSpecialties = ['yield-farming', 'liquid-staking', 'arbitrage', 'general'];
    const specialties = config.AGENT_BOT_SPECIALTIES.split(',').map(s => s.trim());
    
    for (const specialty of specialties) {
      if (!validSpecialties.includes(specialty)) {
        console.error(`Invalid bot specialty: ${specialty}`);
        console.error(`Valid specialties: ${validSpecialties.join(', ')}`);
        process.exit(1);
      }
    }
  }
}

export function getEnvConfig(): EnvConfig {
  return validateEnvironment();
}