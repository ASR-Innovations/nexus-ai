import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { ContractService } from '../../shared/contract.service';
import { DatabaseProvider } from '../../shared/database.provider';
import { SecurityService } from '../../shared/services/security.service';
import { ProtocolIntegrationService } from './protocol-integration.service';
import { ExecutionEngineService } from './execution-engine.service';
import { MonitoringService } from './monitoring.service';

export interface AgentBotConfig {
  name: string;
  privateKey: string;
  specialties: string[];
  riskTolerance: 'low' | 'medium' | 'high';
  maxActiveIntents: number;
  minReputationThreshold: number;
  autoExecute: boolean;
}

export interface IntentClaim {
  intentId: number;
  claimedAt: number;
  status: 'claimed' | 'plan_submitted' | 'approved' | 'executing' | 'completed' | 'failed';
}

@Injectable()
export class AgentBotService implements OnModuleInit {
  private readonly logger = new Logger(AgentBotService.name);
  private wallet!: ethers.Wallet;
  private provider!: ethers.JsonRpcProvider;
  private isRegistered = false;
  private isMonitoring = false;
  private activeClaims = new Map<number, IntentClaim>();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(
    private configService: ConfigService,
    private contractService: ContractService,
    private databaseProvider: DatabaseProvider,
    private securityService: SecurityService,
    private protocolIntegration: ProtocolIntegrationService,
    private executionEngine: ExecutionEngineService,
    private monitoring: MonitoringService,
  ) {}

  async onModuleInit() {
    // Only initialize if agent bot is enabled
    const botEnabled = this.configService.get<boolean>('AGENT_BOT_ENABLED', false);
    if (!botEnabled) {
      this.logger.log('Agent bot is disabled. Set AGENT_BOT_ENABLED=true to enable.');
      return;
    }

    await this.initializeBot();
  }

  private async initializeBot() {
    try {
      // Initialize wallet and provider
      const privateKey = this.configService.get<string>('AGENT_BOT_PRIVATE_KEY');
      if (!privateKey) {
        this.logger.warn('AGENT_BOT_PRIVATE_KEY not configured. Agent bot will not start.');
        return;
      }

      const rpcUrl = this.configService.get('app.blockchain.polkadotHub.rpcUrl');
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      this.logger.log(`🤖 Initializing Agent Bot: ${this.wallet.address}`);

      // Check if already registered
      await this.checkRegistrationStatus();

      // Start monitoring if registered
      if (this.isRegistered) {
        await this.startMonitoring();
      } else {
        this.logger.log('Agent not registered. Use /api/agents/bot/register to register this bot.');
      }

    } catch (error) {
      this.logger.error('Failed to initialize agent bot:', error);
    }
  }

  async registerBot(config: Partial<AgentBotConfig>): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      if (this.isRegistered) {
        return { success: false, error: 'Agent already registered' };
      }

      const botConfig: AgentBotConfig = {
        name: config.name || 'NexusAI Agent Bot',
        privateKey: this.wallet.privateKey,
        specialties: config.specialties || ['yield-farming', 'liquid-staking'],
        riskTolerance: config.riskTolerance || 'medium',
        maxActiveIntents: config.maxActiveIntents || 5,
        minReputationThreshold: config.minReputationThreshold || 3000,
        autoExecute: config.autoExecute ?? true,
      };

      // Create metadata
      const metadata = {
        name: botConfig.name,
        description: 'Autonomous DeFi execution agent powered by NexusAI',
        specialties: botConfig.specialties,
        riskTolerance: botConfig.riskTolerance,
        version: '1.0.0',
        contact: 'bot@nexusai.protocol',
        website: 'https://nexusai.protocol',
        autonomous: true,
      };

      // Store metadata (in production, upload to IPFS)
      const metadataURI = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;

      // Register on-chain
      const stakeAmount = this.configService.get<string>('AGENT_BOT_STAKE_AMOUNT', '10.0');
      const params = {
        metadataURI,
        value: ethers.parseEther(stakeAmount),
      };

      const unsignedTx = await this.contractService.buildRegisterAgentTransaction(params);
      
      // Sign and send transaction
      const tx = await this.wallet.sendTransaction({
        to: unsignedTx.to,
        data: unsignedTx.data,
        value: unsignedTx.value,
        gasLimit: unsignedTx.gasLimit,
        gasPrice: unsignedTx.gasPrice,
      });

      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        // Store bot config in database
        await this.storeBotConfig(botConfig);
        
        this.isRegistered = true;
        this.logger.log(`✅ Agent bot registered successfully! TX: ${receipt.hash}`);
        
        // Start monitoring
        await this.startMonitoring();
        
        return { success: true, transactionHash: receipt.hash };
      } else {
        return { success: false, error: 'Transaction failed' };
      }

    } catch (error) {
      this.logger.error('Failed to register agent bot:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async checkRegistrationStatus() {
    try {
      const agent = await this.contractService.getAgent(this.wallet.address);
      this.isRegistered = agent.isActive && Number(agent.stakeAmount) > 0;
      
      if (this.isRegistered) {
        this.logger.log(`✅ Agent bot is registered with ${ethers.formatEther(agent.stakeAmount)} PAS staked`);
      }
    } catch (error) {
      this.logger.log('Agent bot not registered on-chain');
      this.isRegistered = false;
    }
  }

  private async startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.logger.log('🔍 Starting intent monitoring...');

    // Monitor every 10 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorIntents();
        await this.processActiveClaims();
      } catch (error) {
        this.logger.error('Monitoring error:', error);
      }
    }, 10000);

    // Initial scan
    await this.monitorIntents();
  }

  private async monitorIntents() {
    try {
      // Get pending intents from database
      const result = await this.databaseProvider.query(
        `SELECT * FROM intents 
         WHERE status = 'PENDING' 
         AND deadline > $1 
         ORDER BY created_at ASC 
         LIMIT 10`,
        [Math.floor(Date.now() / 1000)]
      );

      for (const intent of result.rows) {
        if (await this.shouldClaimIntent(intent)) {
          await this.claimIntent(intent.id);
        }
      }
    } catch (error) {
      this.logger.error('Failed to monitor intents:', error);
    }
  }

  private async shouldClaimIntent(intent: any): Promise<boolean> {
    try {
      // Check if already claimed
      if (this.activeClaims.has(intent.id)) {
        return false;
      }

      // Check active intent limit
      if (this.activeClaims.size >= 5) {
        return false;
      }

      // Check if intent matches our specialties
      const botConfig = await this.getBotConfig();
      if (!this.matchesSpecialties(intent, botConfig.specialties)) {
        return false;
      }

      // Check risk tolerance
      if (!this.matchesRiskTolerance(intent, botConfig.riskTolerance)) {
        return false;
      }

      // Check reputation requirement
      const agent = await this.contractService.getAgent(this.wallet.address);
      if (Number(agent.reputationScore) < botConfig.minReputationThreshold) {
        return false;
      }

      // Check deadline (must have at least 1 hour remaining)
      const timeRemaining = intent.deadline - Math.floor(Date.now() / 1000);
      if (timeRemaining < 3600) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking if should claim intent:', error);
      return false;
    }
  }

  private matchesSpecialties(intent: any, specialties: string[]): boolean {
    // Parse intent goal to determine if it matches our specialties
    const goal = intent.goal_hash || '';
    
    for (const specialty of specialties) {
      switch (specialty) {
        case 'yield-farming':
          if (goal.includes('yield') || goal.includes('farm') || goal.includes('liquidity')) {
            return true;
          }
          break;
        case 'liquid-staking':
          if (goal.includes('stake') || goal.includes('staking')) {
            return true;
          }
          break;
        case 'arbitrage':
          if (goal.includes('arbitrage') || goal.includes('swap')) {
            return true;
          }
          break;
      }
    }
    
    return specialties.includes('general'); // Accept all if general specialty
  }

  private matchesRiskTolerance(intent: any, riskTolerance: string): boolean {
    // For now, accept all risk levels
    // In production, parse intent parameters to determine risk
    return true;
  }

  private async claimIntent(intentId: number) {
    try {
      this.logger.log(`🎯 Attempting to claim intent ${intentId}`);

      // Build claim transaction
      const intentVaultAddress = await this.contractService.getIntentVaultAddress();
      const intentVaultContract = new ethers.Contract(
        intentVaultAddress,
        ['function claimIntent(uint256 intentId) external'],
        this.wallet
      );

      // Estimate gas
      const gasEstimate = await intentVaultContract.claimIntent.estimateGas(intentId);
      const gasPrice = await this.provider.getFeeData();

      // Send transaction
      const tx = await intentVaultContract.claimIntent(intentId, {
        gasLimit: gasEstimate + gasEstimate / BigInt(5), // 20% buffer
        gasPrice: gasPrice.gasPrice,
      });

      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        // Track the claim
        this.activeClaims.set(intentId, {
          intentId,
          claimedAt: Date.now(),
          status: 'claimed',
        });

        this.logger.log(`✅ Successfully claimed intent ${intentId}! TX: ${receipt.hash}`);

        // Generate and submit execution plan
        setTimeout(() => this.generateAndSubmitPlan(intentId), 5000);
      }

    } catch (error) {
      this.logger.error(`Failed to claim intent ${intentId}:`, error);
    }
  }

  private async generateAndSubmitPlan(intentId: number) {
    try {
      this.logger.log(`📋 Generating execution plan for intent ${intentId}`);

      // Get intent details
      const intent = await this.contractService.getIntent(BigInt(intentId));
      
      // Generate execution plan using our strategy engine
      const plan = await this.protocolIntegration.generateExecutionPlan(intent);
      
      // Submit plan to contract
      const intentVaultAddress = await this.contractService.getIntentVaultAddress();
      const intentVaultContract = new ethers.Contract(
        intentVaultAddress,
        ['function submitPlan(uint256 intentId, bytes calldata planData) external'],
        this.wallet
      );

      const planData = ethers.toUtf8Bytes(JSON.stringify(plan));
      const tx = await intentVaultContract.submitPlan(intentId, planData);
      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        // Update claim status
        const claim = this.activeClaims.get(intentId);
        if (claim) {
          claim.status = 'plan_submitted';
          this.activeClaims.set(intentId, claim);
        }

        this.logger.log(`📋 Plan submitted for intent ${intentId}! TX: ${receipt.hash}`);
      }

    } catch (error) {
      this.logger.error(`Failed to submit plan for intent ${intentId}:`, error);
    }
  }

  private async processActiveClaims() {
    for (const [intentId, claim] of this.activeClaims.entries()) {
      try {
        // Check current status on-chain
        const intent = await this.contractService.getIntent(BigInt(intentId));
        const currentStatus = this.mapIntentStatus(intent.status);

        // Update local status
        if (currentStatus !== claim.status) {
          claim.status = currentStatus as any;
          this.activeClaims.set(intentId, claim);
          
          this.logger.log(`📊 Intent ${intentId} status updated: ${currentStatus}`);
        }

        // Handle status transitions
        switch (currentStatus) {
          case 'APPROVED':
            await this.executeIntent(intentId);
            break;
          case 'COMPLETED':
          case 'FAILED':
          case 'CANCELLED':
          case 'EXPIRED':
            this.activeClaims.delete(intentId);
            this.logger.log(`🏁 Intent ${intentId} finished with status: ${currentStatus}`);
            break;
        }

      } catch (error) {
        this.logger.error(`Error processing claim ${intentId}:`, error);
      }
    }
  }

  private async executeIntent(intentId: number) {
    try {
      const claim = this.activeClaims.get(intentId);
      if (!claim || claim.status === 'executing') {
        return; // Already executing or not found
      }

      this.logger.log(`⚡ Starting execution for intent ${intentId}`);

      // Update status
      claim.status = 'executing';
      this.activeClaims.set(intentId, claim);

      // Execute using our execution engine
      const result = await this.executionEngine.executeIntent(intentId);

      if (result.success) {
        claim.status = 'completed';
        this.logger.log(`✅ Successfully executed intent ${intentId}`);
      } else {
        claim.status = 'failed';
        this.logger.error(`❌ Failed to execute intent ${intentId}: ${result.error}`);
      }

      this.activeClaims.set(intentId, claim);

    } catch (error) {
      this.logger.error(`Execution error for intent ${intentId}:`, error);
      
      const claim = this.activeClaims.get(intentId);
      if (claim) {
        claim.status = 'failed';
        this.activeClaims.set(intentId, claim);
      }
    }
  }

  private mapIntentStatus(status: number): string {
    const statusMap = [
      'PENDING', 'ASSIGNED', 'PLAN_SUBMITTED', 'APPROVED',
      'EXECUTING', 'AWAITING_CONFIRMATION', 'COMPLETED',
      'FAILED', 'CANCELLED', 'EXPIRED'
    ];
    return statusMap[status] || 'UNKNOWN';
  }

  private async storeBotConfig(config: AgentBotConfig) {
    try {
      await this.databaseProvider.query(
        `INSERT INTO agent_bot_configs (address, name, specialties, risk_tolerance, max_active_intents, auto_execute, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (address) DO UPDATE SET
         name = $2, specialties = $3, risk_tolerance = $4, max_active_intents = $5, auto_execute = $6`,
        [
          this.wallet.address.toLowerCase(),
          config.name,
          JSON.stringify(config.specialties),
          config.riskTolerance,
          config.maxActiveIntents,
          config.autoExecute,
          Date.now()
        ]
      );
    } catch (error) {
      this.logger.error('Failed to store bot config:', error);
    }
  }

  private async getBotConfig(): Promise<AgentBotConfig> {
    try {
      const result = await this.databaseProvider.query(
        'SELECT * FROM agent_bot_configs WHERE address = $1',
        [this.wallet.address.toLowerCase()]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          name: row.name,
          privateKey: this.wallet.privateKey,
          specialties: JSON.parse(row.specialties),
          riskTolerance: row.risk_tolerance,
          maxActiveIntents: row.max_active_intents,
          minReputationThreshold: 3000,
          autoExecute: row.auto_execute,
        };
      }
    } catch (error) {
      this.logger.error('Failed to get bot config:', error);
    }

    // Return default config
    return {
      name: 'NexusAI Agent Bot',
      privateKey: this.wallet.privateKey,
      specialties: ['yield-farming', 'liquid-staking'],
      riskTolerance: 'medium',
      maxActiveIntents: 5,
      minReputationThreshold: 3000,
      autoExecute: true,
    };
  }

  // Public API methods
  async getBotStatus() {
    return {
      address: this.wallet?.address,
      isRegistered: this.isRegistered,
      isMonitoring: this.isMonitoring,
      activeClaims: Array.from(this.activeClaims.values()),
      balance: this.wallet ? await this.provider.getBalance(this.wallet.address) : '0',
    };
  }

  async stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    this.logger.log('🛑 Stopped intent monitoring');
  }

  async startManualMonitoring() {
    if (!this.isRegistered) {
      throw new Error('Agent bot must be registered first');
    }
    await this.startMonitoring();
  }
}