import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  COMPLETE_INTENT_VAULT_ABI,
  COMPLETE_AGENT_REGISTRY_ABI,
  COMPLETE_EXECUTION_MANAGER_ABI
} from './contract-abis';
import {
  Intent,
  Agent,
  Execution,
  IntentStatus,
  ExecutionStatus,
  UnsignedTransaction,
  CreateIntentParams,
  RegisterAgentParams,
  ExecuteIntentParams,
  CONTRACT_CONSTANTS
} from './types/contract.types';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);
  private provider!: ethers.JsonRpcProvider;
  private intentVaultContract!: ethers.Contract;
  private agentRegistryContract!: ethers.Contract;
  private executionManagerContract!: ethers.Contract;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const mockExternalApis = this.configService.get('MOCK_EXTERNAL_APIS', 'false') === 'true';

    if (mockExternalApis) {
      this.logger.log('Mocking external APIs - skipping blockchain initialization');
      return;
    }
    
    await this.initializeProvider();
    await this.initializeContracts();
  }

  private async initializeProvider() {
    const rpcUrl = this.configService.get('POLKADOT_HUB_RPC_URL', 'https://eth-rpc-testnet.polkadot.io/');
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    try {
      const network = await this.provider.getNetwork();
      this.logger.log(`Connected to Polkadot Hub network: ${network.name} (${network.chainId})`);
    } catch (error) {
      this.logger.error('Failed to connect to Polkadot Hub:', error);
      throw error;
    }
  }

  private async initializeContracts() {
    const intentVaultAddress = this.configService.get('INTENT_VAULT_ADDRESS');
    const agentRegistryAddress = this.configService.get('AGENT_REGISTRY_ADDRESS');
    const executionManagerAddress = this.configService.get('EXECUTION_MANAGER_ADDRESS');

    if (!intentVaultAddress || !agentRegistryAddress || !executionManagerAddress) {
      this.logger.warn('Contract addresses not configured. Some functionality may be limited.');
      return;
    }

    this.intentVaultContract = new ethers.Contract(
      intentVaultAddress,
      COMPLETE_INTENT_VAULT_ABI,
      this.provider
    );

    this.agentRegistryContract = new ethers.Contract(
      agentRegistryAddress,
      COMPLETE_AGENT_REGISTRY_ABI,
      this.provider
    );

    this.executionManagerContract = new ethers.Contract(
      executionManagerAddress,
      COMPLETE_EXECUTION_MANAGER_ABI,
      this.provider
    );

    this.logger.log('Contract instances initialized successfully');
  }

  // Provider and basic utilities
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  async getCurrentBlock(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice || BigInt(0);
  }

  async estimateGas(transaction: Partial<ethers.TransactionRequest>): Promise<bigint> {
    return this.provider.estimateGas(transaction);
  }
  // IntentVault read functions
  async getIntent(intentId: bigint): Promise<Intent> {
    try {
      const result = await this.intentVaultContract.getIntent(intentId);
      return {
        user: result.user,
        amount: result.amount,
        goalHash: result.goalHash,
        maxSlippageBps: result.maxSlippageBps,
        deadline: result.deadline,
        minYieldBps: result.minYieldBps,
        maxLockDuration: result.maxLockDuration,
        approvedProtocols: result.approvedProtocols,
        status: result.status as IntentStatus,
        assignedAgent: result.assignedAgent,
        executionPlan: result.executionPlan,
        executionPlanHash: result.executionPlanHash,
        createdAt: result.createdAt
      };
    } catch (error) {
      this.logger.error(`Failed to get intent ${intentId}:`, error);
      throw error;
    }
  }

  async getIntentStatus(intentId: bigint): Promise<IntentStatus> {
    try {
      return await this.intentVaultContract.getIntentStatus(intentId);
    } catch (error) {
      this.logger.error(`Failed to get intent status ${intentId}:`, error);
      throw error;
    }
  }

  async isIntentExpired(intentId: bigint): Promise<boolean> {
    try {
      return await this.intentVaultContract.isIntentExpired(intentId);
    } catch (error) {
      this.logger.error(`Failed to check if intent expired ${intentId}:`, error);
      throw error;
    }
  }

  async getApprovedProtocols(intentId: bigint): Promise<string[]> {
    try {
      return await this.intentVaultContract.getApprovedProtocols(intentId);
    } catch (error) {
      this.logger.error(`Failed to get approved protocols ${intentId}:`, error);
      throw error;
    }
  }

  async getNextIntentId(): Promise<bigint> {
    try {
      return await this.intentVaultContract.nextIntentId();
    } catch (error) {
      this.logger.error('Failed to get next intent ID:', error);
      throw error;
    }
  }

  // IntentVault constants
  async getMinDeposit(): Promise<bigint> {
    try {
      return await this.intentVaultContract.MIN_DEPOSIT();
    } catch (error) {
      this.logger.error('Failed to get MIN_DEPOSIT:', error);
      return CONTRACT_CONSTANTS.MIN_DEPOSIT;
    }
  }

  async getMaxSlippageBps(): Promise<bigint> {
    try {
      return await this.intentVaultContract.MAX_SLIPPAGE_BPS();
    } catch (error) {
      this.logger.error('Failed to get MAX_SLIPPAGE_BPS:', error);
      return BigInt(CONTRACT_CONSTANTS.MAX_SLIPPAGE_BPS);
    }
  }

  async getProtocolFeeBps(): Promise<bigint> {
    try {
      return await this.intentVaultContract.PROTOCOL_FEE_BPS();
    } catch (error) {
      this.logger.error('Failed to get PROTOCOL_FEE_BPS:', error);
      return BigInt(CONTRACT_CONSTANTS.PROTOCOL_FEE_BPS);
    }
  }
  // AgentRegistry read functions
  async getAgent(agentAddress: string): Promise<Agent> {
    try {
      const result = await this.agentRegistryContract.getAgent(agentAddress);
      return {
        stakeAmount: result.stakeAmount,
        reputationScore: result.reputationScore,
        successCount: result.successCount,
        failCount: result.failCount,
        totalExecutions: result.totalExecutions,
        isActive: result.isActive,
        metadataURI: result.metadataURI,
        registeredAt: result.registeredAt
      };
    } catch (error) {
      this.logger.error(`Failed to get agent ${agentAddress}:`, error);
      throw error;
    }
  }

  async isActiveAgent(agentAddress: string): Promise<boolean> {
    try {
      return await this.agentRegistryContract.isActiveAgent(agentAddress);
    } catch (error) {
      this.logger.error(`Failed to check if agent is active ${agentAddress}:`, error);
      throw error;
    }
  }

  async getTopAgents(count: number): Promise<string[]> {
    try {
      return await this.agentRegistryContract.getTopAgents(count);
    } catch (error) {
      this.logger.error(`Failed to get top ${count} agents:`, error);
      throw error;
    }
  }

  async getAgentReputation(agentAddress: string): Promise<bigint> {
    try {
      return await this.agentRegistryContract.getAgentReputation(agentAddress);
    } catch (error) {
      this.logger.error(`Failed to get agent reputation ${agentAddress}:`, error);
      throw error;
    }
  }

  async getAgentStake(agentAddress: string): Promise<bigint> {
    try {
      return await this.agentRegistryContract.getAgentStake(agentAddress);
    } catch (error) {
      this.logger.error(`Failed to get agent stake ${agentAddress}:`, error);
      throw error;
    }
  }

  // AgentRegistry constants
  async getMinStake(): Promise<bigint> {
    try {
      return await this.agentRegistryContract.MIN_STAKE();
    } catch (error) {
      this.logger.error('Failed to get MIN_STAKE:', error);
      return CONTRACT_CONSTANTS.MIN_STAKE;
    }
  }

  async getInitialReputation(): Promise<bigint> {
    try {
      return await this.agentRegistryContract.INITIAL_REPUTATION();
    } catch (error) {
      this.logger.error('Failed to get INITIAL_REPUTATION:', error);
      return BigInt(CONTRACT_CONSTANTS.INITIAL_REPUTATION);
    }
  }

  async getSlashPercent(): Promise<bigint> {
    try {
      return await this.agentRegistryContract.SLASH_PERCENT();
    } catch (error) {
      this.logger.error('Failed to get SLASH_PERCENT:', error);
      return BigInt(CONTRACT_CONSTANTS.SLASH_PERCENT);
    }
  }
  // ExecutionManager read functions
  async getExecution(intentId: bigint): Promise<Execution> {
    try {
      const result = await this.executionManagerContract.getExecution(intentId);
      return {
        intentId: result.intentId,
        status: result.status as ExecutionStatus,
        totalSteps: result.totalSteps,
        completedSteps: result.completedSteps,
        startedAt: result.startedAt
      };
    } catch (error) {
      this.logger.error(`Failed to get execution ${intentId}:`, error);
      throw error;
    }
  }

  async isExecutionInProgress(intentId: bigint): Promise<boolean> {
    try {
      return await this.executionManagerContract.isExecutionInProgress(intentId);
    } catch (error) {
      this.logger.error(`Failed to check execution progress ${intentId}:`, error);
      throw error;
    }
  }

  async buildTransferXCM(paraId: number, beneficiary: string, amount: bigint): Promise<string> {
    try {
      return await this.executionManagerContract.buildTransferXCM(paraId, beneficiary, amount);
    } catch (error) {
      this.logger.error(`Failed to build XCM transfer:`, error);
      throw error;
    }
  }

  async weighMessage(xcmMessage: string): Promise<bigint> {
    try {
      return await this.executionManagerContract.weighMessage(xcmMessage);
    } catch (error) {
      this.logger.error('Failed to weigh XCM message:', error);
      throw error;
    }
  }

  async getXcmPrecompileAddress(): Promise<string> {
    try {
      return await this.executionManagerContract.XCM_PRECOMPILE();
    } catch (error) {
      this.logger.error('Failed to get XCM precompile address:', error);
      return CONTRACT_CONSTANTS.XCM_PRECOMPILE;
    }
  }
  // Transaction building functions
  async buildCreateIntentTransaction(params: CreateIntentParams): Promise<UnsignedTransaction> {
    try {
      const data = this.intentVaultContract.interface.encodeFunctionData('createIntent', [
        params.goalHash,
        params.maxSlippageBps,
        params.deadline,
        params.minYieldBps,
        params.maxLockDuration,
        params.approvedProtocols
      ]);

      const gasLimit = await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data,
        value: params.value
      });

      const gasPrice = await this.getGasPrice();

      return {
        to: await this.intentVaultContract.getAddress(),
        data,
        value: params.value.toString(),
        gasLimit: (gasLimit + gasLimit / BigInt(5)).toString(), // Add 20% buffer
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      this.logger.error('Failed to build createIntent transaction:', error);
      throw error;
    }
  }

  async buildClaimIntentTransaction(intentId: bigint): Promise<UnsignedTransaction> {
    try {
      const data = this.intentVaultContract.interface.encodeFunctionData('claimIntent', [intentId]);

      const gasLimit = await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data
      });

      const gasPrice = await this.getGasPrice();

      return {
        to: await this.intentVaultContract.getAddress(),
        data,
        value: '0',
        gasLimit: (gasLimit + gasLimit / BigInt(5)).toString(),
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      this.logger.error('Failed to build claimIntent transaction:', error);
      throw error;
    }
  }

  async buildSubmitPlanTransaction(intentId: bigint, executionPlan: string): Promise<UnsignedTransaction> {
    try {
      const data = this.intentVaultContract.interface.encodeFunctionData('submitPlan', [
        intentId,
        executionPlan
      ]);

      const gasLimit = await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data
      });

      const gasPrice = await this.getGasPrice();

      return {
        to: await this.intentVaultContract.getAddress(),
        data,
        value: '0',
        gasLimit: (gasLimit + gasLimit / BigInt(5)).toString(),
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      this.logger.error('Failed to build submitPlan transaction:', error);
      throw error;
    }
  }
  async buildApprovePlanTransaction(intentId: bigint): Promise<UnsignedTransaction> {
    try {
      const data = this.intentVaultContract.interface.encodeFunctionData('approvePlan', [intentId]);

      const gasLimit = await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data
      });

      const gasPrice = await this.getGasPrice();

      return {
        to: await this.intentVaultContract.getAddress(),
        data,
        value: '0',
        gasLimit: (gasLimit + gasLimit / BigInt(5)).toString(),
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      this.logger.error('Failed to build approvePlan transaction:', error);
      throw error;
    }
  }

  async buildExecuteIntentTransaction(intentId: bigint): Promise<UnsignedTransaction> {
    try {
      const data = this.intentVaultContract.interface.encodeFunctionData('executeIntent', [intentId]);

      const gasLimit = await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data
      });

      const gasPrice = await this.getGasPrice();

      return {
        to: await this.intentVaultContract.getAddress(),
        data,
        value: '0',
        gasLimit: (gasLimit + gasLimit / BigInt(5)).toString(),
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      this.logger.error('Failed to build executeIntent transaction:', error);
      throw error;
    }
  }

  async buildCancelIntentTransaction(intentId: bigint): Promise<UnsignedTransaction> {
    try {
      const data = this.intentVaultContract.interface.encodeFunctionData('cancelIntent', [intentId]);

      const gasLimit = await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data
      });

      const gasPrice = await this.getGasPrice();

      return {
        to: await this.intentVaultContract.getAddress(),
        data,
        value: '0',
        gasLimit: (gasLimit + gasLimit / BigInt(5)).toString(),
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      this.logger.error('Failed to build cancelIntent transaction:', error);
      throw error;
    }
  }

  async buildRegisterAgentTransaction(params: RegisterAgentParams): Promise<UnsignedTransaction> {
    try {
      const data = this.agentRegistryContract.interface.encodeFunctionData('registerAgent', [
        params.metadataURI
      ]);

      const gasLimit = await this.estimateGas({
        to: await this.agentRegistryContract.getAddress(),
        data,
        value: params.value
      });

      const gasPrice = await this.getGasPrice();

      return {
        to: await this.agentRegistryContract.getAddress(),
        data,
        value: params.value.toString(),
        gasLimit: (gasLimit + gasLimit / BigInt(5)).toString(),
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      this.logger.error('Failed to build registerAgent transaction:', error);
      throw error;
    }
  }
  // Utility functions for gas estimation and transaction validation
  async estimateCreateIntentGas(params: CreateIntentParams): Promise<bigint> {
    try {
      return await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data: this.intentVaultContract.interface.encodeFunctionData('createIntent', [
          params.goalHash,
          params.maxSlippageBps,
          params.deadline,
          params.minYieldBps,
          params.maxLockDuration,
          params.approvedProtocols
        ]),
        value: params.value
      });
    } catch (error) {
      this.logger.error('Failed to estimate createIntent gas:', error);
      // Return fallback gas limit
      return BigInt(500000);
    }
  }

  async estimateExecuteIntentGas(intentId: bigint): Promise<bigint> {
    try {
      return await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data: this.intentVaultContract.interface.encodeFunctionData('executeIntent', [intentId])
      });
    } catch (error) {
      this.logger.error('Failed to estimate executeIntent gas:', error);
      return BigInt(300000);
    }
  }

  async estimateRegisterAgentGas(params: RegisterAgentParams): Promise<bigint> {
    try {
      return await this.estimateGas({
        to: await this.agentRegistryContract.getAddress(),
        data: this.agentRegistryContract.interface.encodeFunctionData('registerAgent', [
          params.metadataURI
        ]),
        value: params.value
      });
    } catch (error) {
      this.logger.error('Failed to estimate registerAgent gas:', error);
      return BigInt(200000);
    }
  }

  // Contract address getters
  async getIntentVaultAddress(): Promise<string> {
    return await this.intentVaultContract.getAddress();
  }

  async getAgentRegistryAddress(): Promise<string> {
    return await this.agentRegistryContract.getAddress();
  }

  async getExecutionManagerAddress(): Promise<string> {
    return await this.executionManagerContract.getAddress();
  }

  // Direct contract access (for advanced usage)
  getIntentVaultContract(): ethers.Contract {
    return this.intentVaultContract;
  }

  getAgentRegistryContract(): ethers.Contract {
    return this.agentRegistryContract;
  }

  getExecutionManagerContract(): ethers.Contract {
    return this.executionManagerContract;
  }

  // Additional methods for security services
  async isProtocolWhitelisted(protocolAddress: string): Promise<boolean> {
    try {
      // Mock implementation for development
      const mockExternalApis = this.configService.get('MOCK_EXTERNAL_APIS', false);
      
      if (mockExternalApis) {
        // Mock whitelisted protocols
        const mockWhitelisted = [
          '0x1234567890123456789012345678901234567890',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eA',
          '0xa0b86a33e6441e8c533a9dcf2a85c4c2742f1ac7',
          '0xb41bd4c99da73510004633d1b29b63a469e6ca67',
        ];
        return mockWhitelisted.includes(protocolAddress.toLowerCase());
      }

      // In production, this would check the contract's whitelist
      // For now, return true for valid addresses
      return /^0x[a-fA-F0-9]{40}$/.test(protocolAddress);
    } catch (error) {
      this.logger.error(`Failed to check protocol whitelist for ${protocolAddress}:`, error);
      return false;
    }
  }

  async getAgentActiveIntentCount(agentAddress: string): Promise<number> {
    try {
      // Mock implementation - in production would query contract
      const mockExternalApis = this.configService.get('MOCK_EXTERNAL_APIS', false);
      
      if (mockExternalApis) {
        return Math.floor(Math.random() * 5); // Random 0-4 active intents
      }

      // In production, query the contract for active intent count
      return 0;
    } catch (error) {
      this.logger.error(`Failed to get active intent count for ${agentAddress}:`, error);
      return 0;
    }
  }

  async executeIntentVaultChange(): Promise<UnsignedTransaction> {
    try {
      // Build transaction for intent vault change (timelock operation)
      const data = '0x'; // Placeholder - would encode actual function call
      
      const gasLimit = await this.estimateGas({
        to: await this.intentVaultContract.getAddress(),
        data
      });

      const gasPrice = await this.getGasPrice();

      return {
        to: await this.intentVaultContract.getAddress(),
        data,
        value: '0',
        gasLimit: (gasLimit + gasLimit / BigInt(5)).toString(),
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      this.logger.error('Failed to build executeIntentVaultChange transaction:', error);
      throw error;
    }
  }

  async isPaused(contract: 'intentVault' | 'agentRegistry' | 'executionManager'): Promise<boolean> {
    try {
      // Mock implementation - in production would check contract pause status
      const mockExternalApis = this.configService.get('MOCK_EXTERNAL_APIS', false);
      
      if (mockExternalApis) {
        return false; // Not paused in mock mode
      }

      // In production, check the contract's paused state
      let targetContract: ethers.Contract;
      switch (contract) {
        case 'intentVault':
          targetContract = this.intentVaultContract;
          break;
        case 'agentRegistry':
          targetContract = this.agentRegistryContract;
          break;
        case 'executionManager':
          targetContract = this.executionManagerContract;
          break;
      }

      // Assuming contracts have a paused() function
      try {
        return await targetContract.paused();
      } catch {
        // If paused() doesn't exist, assume not paused
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to check pause status for ${contract}:`, error);
      return false;
    }
  }

  async getMaxActiveIntentsPerAgent(): Promise<number> {
    try {
      // Mock implementation - in production would query contract
      const mockExternalApis = this.configService.get('MOCK_EXTERNAL_APIS', false);
      
      if (mockExternalApis) {
        return 10; // Mock limit of 10 active intents per agent
      }

      // In production, query the contract for the limit
      return 10;
    } catch (error) {
      this.logger.error('Failed to get max active intents per agent:', error);
      return 10; // Default fallback
    }
  }
}