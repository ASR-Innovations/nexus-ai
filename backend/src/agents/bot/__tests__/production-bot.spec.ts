import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProductionBotService } from '../production-bot.service';
import { DatabaseProvider } from '../../../shared/database.provider';
import { ContractService } from '../../../shared/contract.service';
import { CircuitBreakerService } from '../../../shared/circuit-breaker.service';
import { ExecutionEngineService } from '../execution-engine.service';
import { MonitoringService } from '../monitoring.service';
import { WalletManagerService } from '../wallet-manager.service';
import { ErrorHandlingService } from '../error-handling.service';

describe('ProductionBotService', () => {
  let service: ProductionBotService;
  let configService: ConfigService;
  let databaseProvider: DatabaseProvider;
  let contractService: ContractService;
  let circuitBreaker: CircuitBreakerService;
  let executionEngine: ExecutionEngineService;
  let monitoring: MonitoringService;
  let walletManager: WalletManagerService;
  let errorHandler: ErrorHandlingService;

  beforeEach(async () => {
    // Create mocks
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          BOT_ENABLED: true,
          BOT_POLLING_INTERVAL_MS: 10000,
          BOT_MAX_CONCURRENT_EXECUTIONS: 5,
          BOT_MIN_REPUTATION: 3000,
          BOT_AUTO_CLAIM: true,
          BOT_AUTO_EXECUTE: true,
          POLKADOT_HUB_RPC_URL: 'https://polkadot-asset-hub-rpc.polkadot.io',
          MOONBEAM_RPC_URL: 'https://rpc.api.moonbeam.network',
          MOONBEAM_ENABLED: false,
          MAX_GAS_PRICE: '100000000000',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const mockDatabaseProvider = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    const mockContractService = {
      getProvider: jest.fn().mockReturnValue({
        getBlockNumber: jest.fn().mockResolvedValue(1000),
        destroy: jest.fn(),
      }),
      getAgentReputation: jest.fn().mockResolvedValue(BigInt(5000)),
      buildClaimIntentTransaction: jest.fn().mockResolvedValue({
        to: '0x123',
        data: '0x',
        value: '0',
        gasLimit: '100000',
        gasPrice: '1000000000',
      }),
    };

    const mockCircuitBreaker = {
      execute: jest.fn().mockImplementation(async (name, fn) => fn()),
      getAllStats: jest.fn().mockReturnValue({}),
      reset: jest.fn(),
    };

    const mockExecutionEngine = {
      executeStrategy: jest.fn().mockResolvedValue({
        intentId: 1,
        status: 'completed',
        currentStep: 3,
        totalSteps: 3,
        completedSteps: 3,
        startTime: new Date(),
        endTime: new Date(),
        transactionHashes: ['0xabc'],
        gasUsed: '100000',
      }),
    };

    const mockMonitoring = {
      recordIntentClaim: jest.fn().mockResolvedValue(undefined),
      recordExecutionStart: jest.fn().mockResolvedValue(undefined),
      recordExecutionComplete: jest.fn().mockResolvedValue(undefined),
      recordExecutionError: jest.fn().mockResolvedValue(undefined),
      getBotMetrics: jest.fn().mockResolvedValue({
        totalIntentsClaimed: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        averageExecutionTime: 5000,
        totalGasUsed: '1000000',
        totalFeesEarned: '0.1',
        currentReputation: 5000,
        activeIntents: 2,
        uptime: 3600000,
        lastActivity: new Date(),
      }),
    };

    const mockWalletManager = {
      getEVMAddress: jest.fn().mockReturnValue('0xAgentAddress'),
      getEVMWallet: jest.fn().mockReturnValue({
        sendTransaction: jest.fn().mockResolvedValue({
          wait: jest.fn().mockResolvedValue({ status: 1 }),
        }),
      }),
    };

    const mockErrorHandler = {
      classifyError: jest.fn().mockReturnValue({
        category: 'network',
        severity: 'medium',
        message: 'Test error',
        recoverability: 'retryable',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionBotService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DatabaseProvider, useValue: mockDatabaseProvider },
        { provide: ContractService, useValue: mockContractService },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
        { provide: ExecutionEngineService, useValue: mockExecutionEngine },
        { provide: MonitoringService, useValue: mockMonitoring },
        { provide: WalletManagerService, useValue: mockWalletManager },
        { provide: ErrorHandlingService, useValue: mockErrorHandler },
      ],
    }).compile();

    service = module.get<ProductionBotService>(ProductionBotService);
    configService = module.get<ConfigService>(ConfigService);
    databaseProvider = module.get<DatabaseProvider>(DatabaseProvider);
    contractService = module.get<ContractService>(ContractService);
    circuitBreaker = module.get<CircuitBreakerService>(CircuitBreakerService);
    executionEngine = module.get<ExecutionEngineService>(ExecutionEngineService);
    monitoring = module.get<MonitoringService>(MonitoringService);
    walletManager = module.get<WalletManagerService>(WalletManagerService);
    errorHandler = module.get<ErrorHandlingService>(ErrorHandlingService);
  });

  afterEach(async () => {
    // Clean up
    if (service.isOperational()) {
      await service.stop();
    }
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load configuration correctly', () => {
      const status = service.getStatus();
      expect(status).toBeDefined();
      expect(status.running).toBe(false);
      expect(status.paused).toBe(false);
    });
  });

  describe('Bot Status', () => {
    it('should return correct operational status', () => {
      expect(service.isOperational()).toBe(false);
    });

    it('should return status information', () => {
      const status = service.getStatus();
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('paused');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('activeExecutions');
    });
  });

  describe('Health Monitoring', () => {
    it('should return health status', async () => {
      const health = await service.getHealth();
      
      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('lastActivity');
      expect(health).toHaveProperty('activeExecutions');
      expect(health).toHaveProperty('networkConnections');
      expect(health).toHaveProperty('circuitBreakers');
      expect(health).toHaveProperty('metrics');
    });

    it('should include metrics in health status', async () => {
      const health = await service.getHealth();
      
      expect(health.metrics).toHaveProperty('totalIntentsProcessed');
      expect(health.metrics).toHaveProperty('successRate');
      expect(health.metrics).toHaveProperty('averageExecutionTime');
    });
  });

  describe('Lifecycle Management', () => {
    it('should start successfully', async () => {
      await service.start();
      expect(service.isOperational()).toBe(true);
    });

    it('should stop successfully', async () => {
      await service.start();
      await service.stop();
      expect(service.isOperational()).toBe(false);
    });

    it('should pause and resume', async () => {
      await service.start();
      await service.pause();
      expect(service.getStatus().paused).toBe(true);
      
      await service.resume();
      expect(service.getStatus().paused).toBe(false);
    });

    it('should not start if already running', async () => {
      await service.start();
      const firstStart = service.getStatus().uptime;
      
      // Try to start again
      await service.start();
      const secondStart = service.getStatus().uptime;
      
      // Uptime should be similar (not reset)
      expect(Math.abs(secondStart - firstStart)).toBeLessThan(100);
    });
  });

  describe('Configuration', () => {
    it('should respect enabled configuration', () => {
      expect(configService.get('BOT_ENABLED')).toBe(true);
    });

    it('should have correct polling interval', () => {
      expect(configService.get('BOT_POLLING_INTERVAL_MS')).toBe(10000);
    });

    it('should have correct concurrent execution limit', () => {
      expect(configService.get('BOT_MAX_CONCURRENT_EXECUTIONS')).toBe(5);
    });
  });
});
