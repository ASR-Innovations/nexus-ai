import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';

export interface SecurityConfiguration {
  // Rate limiting
  maxActiveIntentsPerAgent: number;
  rateLimitWindowMs: number;
  
  // Reputation thresholds
  minReputationForClaim: number;
  maxReputationScore: number;
  initialReputationScore: number;
  
  // Timelock settings
  timelockDurationMs: number;
  
  // Deadline management
  executionBufferSeconds: number;
  deadlineWarningThresholdSeconds: number;
  
  // Slippage protection
  maxSlippageBps: number;
  defaultSlippageBps: number;
  dynamicSlippageEnabled: boolean;
  
  // XCM validation
  minXCMAmount: string;
  maxXCMAmount: string;
  xcmValidationTimeoutMs: number;
  
  // Emergency controls
  emergencyPauseEnabled: boolean;
  pauseGracePeriodMs: number;
  
  // Protocol whitelist
  protocolWhitelistEnabled: boolean;
  whitelistCacheTtlMs: number;
  
  // Monitoring
  metricsEnabled: boolean;
  alertingEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

@Injectable()
export class SecurityConfigService {
  private readonly logger = new Logger(SecurityConfigService.name);
  private config: SecurityConfiguration | null = null;
  private readonly CONFIG_KEY = 'security:config';
  private readonly CONFIG_VERSION_KEY = 'security:config:version';

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.loadConfiguration();
  }

  private async loadConfiguration() {
    try {
      // Try to load from Redis first (hot reload support)
      const cachedConfig = await this.redisService.get(this.CONFIG_KEY);
      
      if (cachedConfig) {
        this.config = JSON.parse(cachedConfig);
        this.logger.log('Loaded security configuration from cache');
      } else {
        // Load default configuration
        this.config = this.getDefaultConfiguration();
        await this.saveConfiguration();
        this.logger.log('Loaded default security configuration');
      }
    } catch (error) {
      this.logger.error('Failed to load security configuration, using defaults:', error);
      this.config = this.getDefaultConfiguration();
    }
  }

  private getDefaultConfiguration(): SecurityConfiguration {
    return {
      // Rate limiting
      maxActiveIntentsPerAgent: this.configService.get<number>('SECURITY_MAX_ACTIVE_INTENTS', 10),
      rateLimitWindowMs: this.configService.get<number>('SECURITY_RATE_LIMIT_WINDOW_MS', 3600000), // 1 hour
      
      // Reputation thresholds
      minReputationForClaim: this.configService.get<number>('SECURITY_MIN_REPUTATION', 3000),
      maxReputationScore: this.configService.get<number>('SECURITY_MAX_REPUTATION', 10000),
      initialReputationScore: this.configService.get<number>('SECURITY_INITIAL_REPUTATION', 5000),
      
      // Timelock settings
      timelockDurationMs: this.configService.get<number>('SECURITY_TIMELOCK_DURATION_MS', 172800000), // 2 days
      
      // Deadline management
      executionBufferSeconds: this.configService.get<number>('SECURITY_EXECUTION_BUFFER_SECONDS', 300), // 5 minutes
      deadlineWarningThresholdSeconds: this.configService.get<number>('SECURITY_DEADLINE_WARNING_SECONDS', 1800), // 30 minutes
      
      // Slippage protection
      maxSlippageBps: this.configService.get<number>('SECURITY_MAX_SLIPPAGE_BPS', 1000), // 10%
      defaultSlippageBps: this.configService.get<number>('SECURITY_DEFAULT_SLIPPAGE_BPS', 500), // 5%
      dynamicSlippageEnabled: this.configService.get<boolean>('SECURITY_DYNAMIC_SLIPPAGE_ENABLED', true),
      
      // XCM validation
      minXCMAmount: this.configService.get<string>('SECURITY_MIN_XCM_AMOUNT', '100000000000000000'), // 0.1 ether
      maxXCMAmount: this.configService.get<string>('SECURITY_MAX_XCM_AMOUNT', '1000000000000000000000'), // 1000 ether
      xcmValidationTimeoutMs: this.configService.get<number>('SECURITY_XCM_VALIDATION_TIMEOUT_MS', 5000),
      
      // Emergency controls
      emergencyPauseEnabled: this.configService.get<boolean>('SECURITY_EMERGENCY_PAUSE_ENABLED', true),
      pauseGracePeriodMs: this.configService.get<number>('SECURITY_PAUSE_GRACE_PERIOD_MS', 30000), // 30 seconds
      
      // Protocol whitelist
      protocolWhitelistEnabled: this.configService.get<boolean>('SECURITY_PROTOCOL_WHITELIST_ENABLED', true),
      whitelistCacheTtlMs: this.configService.get<number>('SECURITY_WHITELIST_CACHE_TTL_MS', 300000), // 5 minutes
      
      // Monitoring
      metricsEnabled: this.configService.get<boolean>('SECURITY_METRICS_ENABLED', true),
      alertingEnabled: this.configService.get<boolean>('SECURITY_ALERTING_ENABLED', true),
      logLevel: this.configService.get<'debug' | 'info' | 'warn' | 'error'>('SECURITY_LOG_LEVEL', 'info'),
    };
  }

  async getConfiguration(): Promise<SecurityConfiguration> {
    if (!this.config) {
      await this.loadConfiguration();
    }
    return { ...this.config! };
  }

  async updateConfiguration(updates: Partial<SecurityConfiguration>): Promise<void> {
    try {
      // Validate configuration updates
      const validatedUpdates = this.validateConfiguration(updates);
      
      // Merge with existing configuration
      this.config = { ...this.config!, ...validatedUpdates };
      
      // Save to Redis for hot reload
      await this.saveConfiguration();
      
      // Increment version for change tracking
      await this.incrementConfigVersion();
      
      this.logger.log('Security configuration updated successfully');
    } catch (error) {
      this.logger.error('Failed to update security configuration:', error);
      throw error;
    }
  }

  private validateConfiguration(config: Partial<SecurityConfiguration>): Partial<SecurityConfiguration> {
    const validated: Partial<SecurityConfiguration> = {};

    // Validate rate limiting
    if (config.maxActiveIntentsPerAgent !== undefined) {
      if (config.maxActiveIntentsPerAgent < 1 || config.maxActiveIntentsPerAgent > 100) {
        throw new Error('maxActiveIntentsPerAgent must be between 1 and 100');
      }
      validated.maxActiveIntentsPerAgent = config.maxActiveIntentsPerAgent;
    }

    // Validate reputation thresholds
    if (config.minReputationForClaim !== undefined) {
      if (config.minReputationForClaim < 0 || config.minReputationForClaim > 10000) {
        throw new Error('minReputationForClaim must be between 0 and 10000');
      }
      validated.minReputationForClaim = config.minReputationForClaim;
    }

    if (config.maxReputationScore !== undefined) {
      if (config.maxReputationScore < 1000 || config.maxReputationScore > 10000) {
        throw new Error('maxReputationScore must be between 1000 and 10000');
      }
      validated.maxReputationScore = config.maxReputationScore;
    }

    // Validate timelock duration
    if (config.timelockDurationMs !== undefined) {
      if (config.timelockDurationMs < 3600000 || config.timelockDurationMs > 604800000) { // 1 hour to 7 days
        throw new Error('timelockDurationMs must be between 1 hour and 7 days');
      }
      validated.timelockDurationMs = config.timelockDurationMs;
    }

    // Validate slippage settings
    if (config.maxSlippageBps !== undefined) {
      if (config.maxSlippageBps < 1 || config.maxSlippageBps > 5000) { // 0.01% to 50%
        throw new Error('maxSlippageBps must be between 1 and 5000');
      }
      validated.maxSlippageBps = config.maxSlippageBps;
    }

    // Copy other valid fields
    const validFields = [
      'rateLimitWindowMs', 'initialReputationScore', 'executionBufferSeconds',
      'deadlineWarningThresholdSeconds', 'defaultSlippageBps', 'dynamicSlippageEnabled',
      'minXCMAmount', 'maxXCMAmount', 'xcmValidationTimeoutMs', 'emergencyPauseEnabled',
      'pauseGracePeriodMs', 'protocolWhitelistEnabled', 'whitelistCacheTtlMs',
      'metricsEnabled', 'alertingEnabled', 'logLevel'
    ];

    validFields.forEach(field => {
      if (config[field as keyof SecurityConfiguration] !== undefined) {
        (validated as any)[field] = config[field as keyof SecurityConfiguration];
      }
    });

    return validated;
  }

  private async saveConfiguration(): Promise<void> {
    await this.redisService.set(
      this.CONFIG_KEY,
      JSON.stringify(this.config),
      300 // 5 minutes TTL for cache refresh
    );
  }

  private async incrementConfigVersion(): Promise<void> {
    await this.redisService.incr(this.CONFIG_VERSION_KEY);
  }

  async getConfigurationVersion(): Promise<number> {
    const version = await this.redisService.get(this.CONFIG_VERSION_KEY);
    return version ? parseInt(version, 10) : 1;
  }

  async reloadConfiguration(): Promise<void> {
    this.logger.log('Reloading security configuration...');
    await this.loadConfiguration();
  }

  // Configuration getters for specific values
  async getMaxActiveIntents(): Promise<number> {
    const config = await this.getConfiguration();
    return config.maxActiveIntentsPerAgent;
  }

  async getMinReputationThreshold(): Promise<number> {
    const config = await this.getConfiguration();
    return config.minReputationForClaim;
  }

  async getTimelockDuration(): Promise<number> {
    const config = await this.getConfiguration();
    return config.timelockDurationMs;
  }

  async getExecutionBuffer(): Promise<number> {
    const config = await this.getConfiguration();
    return config.executionBufferSeconds;
  }

  async getMaxSlippage(): Promise<number> {
    const config = await this.getConfiguration();
    return config.maxSlippageBps;
  }

  async isEmergencyPauseEnabled(): Promise<boolean> {
    const config = await this.getConfiguration();
    return config.emergencyPauseEnabled;
  }

  async isProtocolWhitelistEnabled(): Promise<boolean> {
    const config = await this.getConfiguration();
    return config.protocolWhitelistEnabled;
  }

  async isMetricsEnabled(): Promise<boolean> {
    const config = await this.getConfiguration();
    return config.metricsEnabled;
  }
}