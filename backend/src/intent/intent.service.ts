import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from '../shared/database.provider';
import { ContractService } from '../shared/contract.service';
import { CreateIntentDto, ApproveIntentDto, ExecuteIntentDto } from './intent.dto';
import { ethers } from 'ethers';

@Injectable()
export class IntentService {
  constructor(
    private databaseProvider: DatabaseProvider,
    private contractService: ContractService,
  ) {}

  async createUnsignedTransaction(createIntentDto: CreateIntentDto) {
    try {
      // Build create intent parameters from DTO
      const params = {
        goalHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(createIntentDto.intentParams))),
        maxSlippageBps: createIntentDto.intentParams.minYieldBps || 500, // Default 5% slippage
        deadline: createIntentDto.intentParams.deadline,
        minYieldBps: createIntentDto.intentParams.minYieldBps || 0,
        maxLockDuration: (createIntentDto.intentParams.maxLockDays || 365) * 24 * 60 * 60, // Convert days to seconds
        approvedProtocols: [], // TODO: Extract from strategy
        amount: ethers.parseEther(createIntentDto.intentParams.amount),
        value: ethers.parseEther(createIntentDto.intentParams.amount), // Same as amount for payable function
      };

      // Build unsigned transaction using ContractService
      const unsignedTx = await this.contractService.buildCreateIntentTransaction(params);
      const nextIntentId = await this.contractService.getNextIntentId();

      return {
        unsignedTx,
        intentId: Number(nextIntentId),
      };
    } catch (error) {
      console.error('Create intent error:', error);
      throw error;
    }
  }

  async approveUnsignedTransaction(approveIntentDto: ApproveIntentDto) {
    try {
      // Verify user owns the intent
      const intent = await this.getIntent(approveIntentDto.intentId);
      if (!intent || intent.user_address.toLowerCase() !== approveIntentDto.userId.toLowerCase()) {
        throw new Error('Intent not found or user not authorized');
      }

      // Build unsigned transaction using ContractService
      const unsignedTx = await this.contractService.buildApprovePlanTransaction(
        BigInt(approveIntentDto.intentId)
      );

      return { unsignedTx };
    } catch (error) {
      console.error('Approve intent error:', error);
      throw error;
    }
  }

  async executeUnsignedTransaction(executeIntentDto: ExecuteIntentDto) {
    try {
      // Verify user owns the intent
      const intent = await this.getIntent(executeIntentDto.intentId);
      if (!intent || intent.user_address.toLowerCase() !== executeIntentDto.userId.toLowerCase()) {
        throw new Error('Intent not found or user not authorized');
      }

      // Build unsigned transaction using ContractService
      const unsignedTx = await this.contractService.buildExecuteIntentTransaction(
        BigInt(executeIntentDto.intentId)
      );

      return { unsignedTx };
    } catch (error) {
      console.error('Execute intent error:', error);
      throw error;
    }
  }

  async getIntent(intentId: number) {
    try {
      // First try to get from database (indexed data)
      const result = await this.databaseProvider.query(
        'SELECT * FROM intents WHERE id = $1',
        [intentId]
      );
      
      if (result.rows.length > 0) {
        const dbIntent = result.rows[0];
        
        // Also get on-chain data for latest status
        try {
          const onChainIntent = await this.contractService.getIntent(BigInt(intentId));
          
          return {
            ...dbIntent,
            // Merge with on-chain data for most up-to-date status
            status: this.mapIntentStatus(onChainIntent.status),
            execution_plan_hash: onChainIntent.executionPlanHash,
          };
        } catch (onChainError) {
          // If on-chain query fails, return database data
          console.warn('Failed to fetch on-chain intent data:', onChainError);
          return dbIntent;
        }
      }

      // If not in database, try on-chain only
      try {
        const onChainIntent = await this.contractService.getIntent(BigInt(intentId));
        return {
          id: intentId,
          user_address: onChainIntent.user,
          amount: onChainIntent.amount.toString(),
          goal_hash: onChainIntent.goalHash,
          max_slippage_bps: Number(onChainIntent.maxSlippageBps),
          deadline: Number(onChainIntent.deadline),
          status: this.mapIntentStatus(onChainIntent.status),
          assigned_agent: onChainIntent.assignedAgent,
          execution_plan_hash: onChainIntent.executionPlanHash,
          created_at: Number(onChainIntent.createdAt),
          updated_at: Date.now(),
        };
      } catch (onChainError) {
        console.error('Intent not found on-chain:', onChainError);
        return null;
      }
    } catch (error) {
      console.error('Get intent error:', error);
      throw error;
    }
  }

  async getUserIntents(userAddress: string) {
    try {
      const result = await this.databaseProvider.query(
        'SELECT * FROM intents WHERE user_address = $1 ORDER BY created_at DESC',
        [userAddress.toLowerCase()]
      );
      
      return {
        intents: result.rows,
        total: result.rows.length,
      };
    } catch (error) {
      console.error('Get user intents error:', error);
      throw error;
    }
  }

  /**
   * Map on-chain intent status enum to string
   */
  private mapIntentStatus(status: number): string {
    const statusMap = [
      'PENDING',
      'ASSIGNED', 
      'PLAN_SUBMITTED',
      'APPROVED',
      'EXECUTING',
      'AWAITING_CONFIRMATION',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'EXPIRED'
    ];
    
    return statusMap[status] || 'UNKNOWN';
  }
}