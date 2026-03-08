import { registerAs } from '@nestjs/config';
import { getEnvConfig } from './env.validation';

const envConfig = getEnvConfig();

export default registerAs('app', () => ({
  // Server Configuration
  server: {
    nodeEnv: envConfig.NODE_ENV,
    port: envConfig.PORT,
    host: envConfig.HOST,
    apiBaseUrl: envConfig.API_BASE_URL,
  },

  // Database Configuration
  database: {
    url: envConfig.DATABASE_URL,
    host: envConfig.DB_HOST,
    port: envConfig.DB_PORT,
    name: envConfig.DB_NAME,
    user: envConfig.DB_USER,
    password: envConfig.DB_PASSWORD,
    ssl: envConfig.DB_SSL,
    pool: {
      min: envConfig.DB_POOL_MIN,
      max: envConfig.DB_POOL_MAX,
    },
  },

  // Redis Configuration
  redis: {
    url: envConfig.REDIS_URL,
    host: envConfig.REDIS_HOST,
    port: envConfig.REDIS_PORT,
    password: envConfig.REDIS_PASSWORD,
    db: envConfig.REDIS_DB,
    ttl: envConfig.REDIS_TTL_SECONDS,
  },

  // Blockchain Configuration
  blockchain: {
    polkadotHub: {
      rpcUrl: envConfig.POLKADOT_HUB_RPC_URL,
      wsUrl: envConfig.POLKADOT_HUB_WS_URL,
    },
    hydration: {
      rpcUrl: envConfig.HYDRATION_RPC_URL,
    },
    bifrost: {
      rpcUrl: envConfig.BIFROST_RPC_URL,
    },
    moonbeam: {
      rpcUrl: envConfig.MOONBEAM_RPC_URL,
    },
  },

  // Contract Addresses
  contracts: {
    intentVault: envConfig.INTENT_VAULT_ADDRESS,
    agentRegistry: envConfig.AGENT_REGISTRY_ADDRESS,
    executionManager: envConfig.EXECUTION_MANAGER_ADDRESS,
  },

  // AI Services Configuration
  ai: {
    deepseek: {
      apiKey: envConfig.DEEPSEEK_API_KEY,
      baseUrl: envConfig.DEEPSEEK_BASE_URL,
      models: {
        chat: envConfig.DEEPSEEK_MODEL_CHAT,
        reasoner: envConfig.DEEPSEEK_MODEL_REASONER,
      },
      maxTokens: envConfig.DEEPSEEK_MAX_TOKENS,
      temperature: envConfig.DEEPSEEK_TEMPERATURE,
    },
    mem0: {
      apiKey: envConfig.MEM0_API_KEY,
      baseUrl: envConfig.MEM0_BASE_URL,
      userIdPrefix: envConfig.MEM0_USER_ID_PREFIX,
      agentId: envConfig.MEM0_AGENT_ID,
    },
  },

  // External APIs
  external: {
    coingecko: {
      apiUrl: envConfig.COINGECKO_API_URL,
      apiKey: envConfig.COINGECKO_API_KEY,
    },
  },

  // Rate Limiting Configuration
  rateLimit: {
    chat: {
      perMinute: envConfig.RATE_LIMIT_CHAT_PER_MINUTE,
    },
    intent: {
      perMinute: envConfig.RATE_LIMIT_INTENT_PER_MINUTE,
    },
    portfolio: {
      perMinute: envConfig.RATE_LIMIT_PORTFOLIO_PER_MINUTE,
    },
    windowMs: envConfig.RATE_LIMIT_WINDOW_MS,
  },

  // Caching Configuration
  cache: {
    yieldData: {
      ttl: envConfig.CACHE_YIELD_DATA_TTL,
    },
    portfolio: {
      ttl: envConfig.CACHE_PORTFOLIO_TTL,
    },
    deepseek: {
      ttl: envConfig.CACHE_DEEPSEEK_TTL,
    },
    agentMetadata: {
      ttl: envConfig.CACHE_AGENT_METADATA_TTL,
    },
  },

  // Indexer Configuration
  indexer: {
    startBlock: envConfig.INDEXER_START_BLOCK,
    batchSize: envConfig.INDEXER_BATCH_SIZE,
    reorgDepth: envConfig.INDEXER_REORG_DEPTH,
    pollInterval: envConfig.INDEXER_POLL_INTERVAL_MS,
    xcmConfirmationTimeout: envConfig.INDEXER_XCM_CONFIRMATION_TIMEOUT,
  },

  // WebSocket Configuration
  websocket: {
    port: envConfig.WS_PORT,
    heartbeatInterval: envConfig.WS_HEARTBEAT_INTERVAL,
    maxConnections: envConfig.WS_MAX_CONNECTIONS,
  },

  // Security Configuration
  security: {
    jwtSecret: envConfig.JWT_SECRET,
    corsOrigins: envConfig.CORS_ORIGINS.split(',').map(origin => origin.trim()),
    signatureTimeout: envConfig.SIGNATURE_TIMEOUT_MS,
  },

  // Logging Configuration
  logging: {
    level: envConfig.LOG_LEVEL,
    format: envConfig.LOG_FORMAT,
    filePath: envConfig.LOG_FILE_PATH,
    maxFiles: envConfig.LOG_MAX_FILES,
    maxSize: envConfig.LOG_MAX_SIZE,
  },

  // Monitoring Configuration
  monitoring: {
    sentryDsn: envConfig.SENTRY_DSN,
    metricsEnabled: envConfig.METRICS_ENABLED,
    healthCheckTimeout: envConfig.HEALTH_CHECK_TIMEOUT,
  },

  // Gas Estimation Configuration
  gas: {
    estimationBufferPercent: envConfig.GAS_ESTIMATION_BUFFER_PERCENT,
    priceOracleUrl: envConfig.GAS_PRICE_ORACLE_URL,
    defaultLimit: envConfig.DEFAULT_GAS_LIMIT,
  },

  // Yield Aggregator Configuration
  yieldAggregator: {
    refreshInterval: {
      native: envConfig.YIELD_REFRESH_INTERVAL_NATIVE,
      parachain: envConfig.YIELD_REFRESH_INTERVAL_PARACHAIN,
    },
    snapshotInterval: envConfig.YIELD_SNAPSHOT_INTERVAL,
    cacheFallbackEnabled: envConfig.YIELD_CACHE_FALLBACK_ENABLED,
  },

  // Strategy Engine Configuration
  strategyEngine: {
    maxResults: envConfig.STRATEGY_MAX_RESULTS,
    riskWeights: {
      contract: envConfig.STRATEGY_RISK_WEIGHTS_CONTRACT,
      il: envConfig.STRATEGY_RISK_WEIGHTS_IL,
      lock: envConfig.STRATEGY_RISK_WEIGHTS_LOCK,
      tvl: envConfig.STRATEGY_RISK_WEIGHTS_TVL,
      volatility: envConfig.STRATEGY_RISK_WEIGHTS_VOLATILITY,
    },
  },

  // Development Configuration
  development: {
    debugEnabled: envConfig.DEBUG_ENABLED,
    mockExternalApis: envConfig.MOCK_EXTERNAL_APIS,
    skipSignatureVerification: envConfig.SKIP_SIGNATURE_VERIFICATION,
    enableApiDocs: envConfig.ENABLE_API_DOCS,
  },
}));