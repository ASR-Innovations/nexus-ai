import { Injectable, Logger } from '@nestjs/common';
import { ContractService } from './contract.service';
import { 
  CreateIntentParams, 
  RegisterAgentParams, 
  UnsignedTransaction,
  Intent,
  Agent,
  IntentStatus
} from './types/contract.types';

/**
 * Example service demonstrating how to use ContractService
 * This shows the patterns for reading from contracts and building transactions
 */
@Injectable()
export class ContractExampleService {
  private readonly logger = new Logger(ContractExampleService.name);

  constructor(private contractService: ContractService) {}

  /**
   * Example: Get intent details and validate status
   */
  async getIntentWithValidation(intentId: bigint): Promise<Intent | null> {
    try {
      const intent = await this.contractService.getIntent(intentId);
      
      // Example validation logic
      if (intent.status === IntentStatus.EXPIRED) {
        this.logger.warn(`Intent ${intentId} has expired`);
        return null;
      }

      return intent;
    } catch (error) {
      this.logger.error(`Failed to get intent ${intentId}:`, error);
      return null;
    }
  }

  /**
   * Example: Build and return transaction for creating an intent
   */
  async prepareCreateIntentTransaction(
    goalHash: string,
    amount: bigint,
    maxSlippageBps: number,
    deadline: number,
    minYieldBps: number,
    maxLockDuration: number,
    approvedProtocols: string[]
  ): Promise<UnsignedTransaction> {
    const params: CreateIntentParams = {
      goalHash,
      maxSlippageBps,
      deadline,
      minYieldBps,
      maxLockDuration,
      approvedProtocols,
      value: amount
    };

    return this.contractService.buildCreateIntentTransaction(params);
  }

  /**
   * Example: Get agent information and check if eligible for assignment
   */
  async checkAgentEligibility(agentAddress: string): Promise<{
    eligible: boolean;
    agent?: Agent;
    reason?: string;
  }> {
    try {
      const isActive = await this.contractService.isActiveAgent(agentAddress);
      
      if (!isActive) {
        return { eligible: false, reason: 'Agent is not active' };
      }

      const agent = await this.contractService.getAgent(agentAddress);
      const minStake = await this.contractService.getMinStake();

      if (agent.stakeAmount < minStake) {
        return { 
          eligible: false, 
          agent, 
          reason: 'Insufficient stake amount' 
        };
      }

      return { eligible: true, agent };
    } catch (error) {
      this.logger.error(`Failed to check agent eligibility ${agentAddress}:`, error);
      return { eligible: false, reason: 'Failed to fetch agent data' };
    }
  }

  /**
   * Example: Get gas estimates for common operations
   */
  async getGasEstimates() {
    try {
      const [gasPrice, currentBlock] = await Promise.all([
        this.contractService.getGasPrice(),
        this.contractService.getCurrentBlock()
      ]);

      // Example parameters for estimation
      const exampleCreateParams: CreateIntentParams = {
        goalHash: '0x' + '0'.repeat(64),
        maxSlippageBps: 100,
        deadline: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        minYieldBps: 500, // 5%
        maxLockDuration: 30 * 24 * 60 * 60, // 30 days
        approvedProtocols: [],
        value: BigInt('1000000000000000000') // 1 ETH
      };

      const createIntentGas = await this.contractService.estimateCreateIntentGas(exampleCreateParams);

      return {
        gasPrice: gasPrice.toString(),
        currentBlock,
        estimates: {
          createIntent: createIntentGas.toString(),
          executeIntent: '300000', // Fallback estimate
          registerAgent: '200000'  // Fallback estimate
        }
      };
    } catch (error) {
      this.logger.error('Failed to get gas estimates:', error);
      throw error;
    }
  }

  /**
   * Example: Get contract constants and configuration
   */
  async getContractConfiguration() {
    try {
      const [
        minDeposit,
        maxSlippageBps,
        protocolFeeBps,
        minStake,
        initialReputation,
        slashPercent
      ] = await Promise.all([
        this.contractService.getMinDeposit(),
        this.contractService.getMaxSlippageBps(),
        this.contractService.getProtocolFeeBps(),
        this.contractService.getMinStake(),
        this.contractService.getInitialReputation(),
        this.contractService.getSlashPercent()
      ]);

      return {
        intentVault: {
          minDeposit: minDeposit.toString(),
          maxSlippageBps: maxSlippageBps.toString(),
          protocolFeeBps: protocolFeeBps.toString()
        },
        agentRegistry: {
          minStake: minStake.toString(),
          initialReputation: initialReputation.toString(),
          slashPercent: slashPercent.toString()
        }
      };
    } catch (error) {
      this.logger.error('Failed to get contract configuration:', error);
      throw error;
    }
  }
}