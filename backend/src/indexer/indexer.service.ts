import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ethers } from 'ethers';
import { ContractProvider } from '../shared/contract.provider';
import { DatabaseProvider } from '../shared/database.provider';
import { RedisProvider } from '../shared/redis.provider';
import { ContractService } from '../shared/contract.service';
import { WebsocketService } from '../websocket/websocket.service';
import { 
  COMPLETE_INTENT_VAULT_ABI,
  COMPLETE_AGENT_REGISTRY_ABI,
  COMPLETE_EXECUTION_MANAGER_ABI
} from '../shared/contract-abis';

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private hydrationApi!: ApiPromise;
  private bifrostApi!: ApiPromise;
  private isIndexing = false;
  private intentVaultContract!: ethers.Contract;
  private agentRegistryContract!: ethers.Contract;
  private executionManagerContract!: ethers.Contract;

  constructor(
    private configService: ConfigService,
    private contractProvider: ContractProvider,
    private databaseProvider: DatabaseProvider,
    private redisProvider: RedisProvider,
    private contractService: ContractService,
    private websocketService: WebsocketService,
  ) {}

  async onModuleInit() {
    const mockExternalApis = this.configService.get('MOCK_EXTERNAL_APIS', false);
    
    if (mockExternalApis) {
      this.logger.log('Mocking external APIs - skipping indexer initialization');
      return;
    }
    
    await this.initializeConnections();
    await this.initializeContracts();
    await this.startIndexing();
  }

  private async initializeConnections() {
    try {
      // Initialize parachain connections for XCM confirmation
      const hydrationProvider = new WsProvider('wss://rpc.hydradx.cloud');
      this.hydrationApi = await ApiPromise.create({ provider: hydrationProvider });

      const bifrostProvider = new WsProvider('wss://bifrost-polkadot.api.onfinality.io/public-ws');
      this.bifrostApi = await ApiPromise.create({ provider: bifrostProvider });

      this.logger.log('Indexer parachain connections initialized');
    } catch (error) {
      this.logger.error('Failed to initialize indexer connections:', error);
    }
  }

  private async initializeContracts() {
    try {
      const provider = this.contractProvider.getProvider();
      
      // Get contract addresses from environment or contract service
      const intentVaultAddress = await this.contractService.getIntentVaultAddress();
      const agentRegistryAddress = await this.contractService.getAgentRegistryAddress();
      const executionManagerAddress = await this.contractService.getExecutionManagerAddress();

      // Initialize contract instances for event listening
      this.intentVaultContract = new ethers.Contract(
        intentVaultAddress,
        COMPLETE_INTENT_VAULT_ABI,
        provider
      );

      this.agentRegistryContract = new ethers.Contract(
        agentRegistryAddress,
        COMPLETE_AGENT_REGISTRY_ABI,
        provider
      );

      this.executionManagerContract = new ethers.Contract(
        executionManagerAddress,
        COMPLETE_EXECUTION_MANAGER_ABI,
        provider
      );

      this.logger.log('Indexer contract instances initialized');
    } catch (error) {
      this.logger.error('Failed to initialize indexer contracts:', error);
    }
  }

  async startIndexing() {
    if (this.isIndexing) return;
    this.isIndexing = true;

    try {
      const provider = this.contractProvider.getProvider();
      
      // Get last indexed block from Redis
      const lastBlock = await this.redisProvider.get('indexer:last_block');
      const currentBlock = await provider.getBlockNumber();
      const startBlock = lastBlock ? Math.max(parseInt(lastBlock) - 10, 0) : Math.max(currentBlock - 100, 0);

      this.logger.log(`Starting indexer from block ${startBlock}, current block: ${currentBlock}`);

      // Set up event listeners for new blocks
      provider.on('block', async (blockNumber) => {
        await this.handleBlock(blockNumber);
      });

      // Catch up missed blocks first
      await this.catchUpBlocks(startBlock, currentBlock);

      this.logger.log('Indexer started successfully');

    } catch (error) {
      this.logger.error('Indexer start error:', error);
      this.isIndexing = false;
    }
  }

  private async handleBlock(blockNumber: number) {
    try {
      // Store processing lock to prevent concurrent processing
      const lockKey = `indexer:processing:${blockNumber}`;
      const lockExists = await this.redisProvider.exists(lockKey);
      if (lockExists) {
        this.logger.debug(`Block ${blockNumber} already being processed`);
        return;
      }

      // Set lock with expiration
      await this.redisProvider.set(lockKey, '1', 60);

      // Check for reorg
      await this.checkReorg(blockNumber);

      // Process events in this block
      await this.processBlockEvents(blockNumber);

      // Store block info in database
      await this.storeBlockInfo(blockNumber);

      // Update last indexed block
      await this.redisProvider.set('indexer:last_block', blockNumber.toString());

      // Clean up lock
      await this.redisProvider.del(lockKey);

    } catch (error) {
      this.logger.error(`Block ${blockNumber} processing error:`, error);
    }
  }

  private async checkReorg(blockNumber: number) {
    try {
      if (blockNumber < 10) return;

      const provider = this.contractProvider.getProvider();
      
      // Check the last 10 blocks for hash changes
      for (let i = 1; i <= 10; i++) {
        const checkBlock = blockNumber - i;
        if (checkBlock < 0) continue;

        const currentBlock = await provider.getBlock(checkBlock);
        
        const storedResult = await this.databaseProvider.query(
          'SELECT block_hash FROM blocks WHERE block_number = $1',
          [checkBlock]
        );

        if (storedResult.rows.length > 0 && currentBlock && storedResult.rows[0].block_hash !== currentBlock.hash) {
          this.logger.warn(`Reorg detected at block ${checkBlock}. Stored hash: ${storedResult.rows[0].block_hash}, Current hash: ${currentBlock.hash}`);
          await this.handleReorg(checkBlock);
          break; // Only handle the earliest reorg point
        }
      }
    } catch (error) {
      this.logger.error('Reorg check error:', error);
    }
  }

  private async handleReorg(fromBlock: number) {
    try {
      this.logger.warn(`Handling blockchain reorganization from block ${fromBlock}`);
      
      // 1. Delete affected database records
      await this.deleteAffectedRecords(fromBlock);
      
      // 2. Re-index blocks from the reorg point
      const provider = this.contractProvider.getProvider();
      const currentBlock = await provider.getBlockNumber();
      
      this.logger.log(`Re-indexing blocks ${fromBlock} to ${currentBlock} after reorg`);
      
      for (let block = fromBlock; block <= currentBlock; block++) {
        try {
          await this.processBlockEvents(block);
          await this.storeBlockInfo(block);
          
          // Update progress every 100 blocks
          if (block % 100 === 0) {
            this.logger.log(`Reorg recovery progress: ${block}/${currentBlock}`);
          }
        } catch (error) {
          this.logger.error(`Error re-indexing block ${block} during reorg recovery:`, error);
          // Continue with next block rather than failing completely
        }
      }
      
      this.logger.log(`Reorg recovery completed from block ${fromBlock}`);
    } catch (error) {
      this.logger.error('Reorg handling error:', error);
    }
  }

  private async deleteAffectedRecords(fromBlock: number) {
    try {
      // Delete block records from the reorg point onwards
      await this.databaseProvider.query(
        'DELETE FROM blocks WHERE block_number >= $1',
        [fromBlock]
      );

      // Get all events that occurred in the affected blocks
      // We need to be careful here - we should only delete records that were created
      // by events in the affected blocks, not all records after a certain timestamp
      
      // For now, we'll use a timestamp-based approach as a fallback
      // In a production system, you'd want to track which block each database record came from
      const provider = this.contractProvider.getProvider();
      const reorgBlock = await provider.getBlock(fromBlock);
      const reorgTimestamp = reorgBlock ? reorgBlock.timestamp * 1000 : Date.now(); // Convert to milliseconds

      this.logger.log(`Deleting records created after reorg timestamp: ${reorgTimestamp}`);

      // Delete potentially affected intent records
      // Note: This is a conservative approach - in practice you'd want more precise tracking
      const affectedIntents = await this.databaseProvider.query(
        'SELECT id FROM intents WHERE created_at >= $1',
        [reorgTimestamp.toString()]
      );

      if (affectedIntents.rows.length > 0) {
        const intentIds = affectedIntents.rows.map((row: any) => row.id);
        this.logger.log(`Deleting ${intentIds.length} potentially affected intents`);

        // Delete related execution records
        await this.databaseProvider.query(
          'DELETE FROM executions WHERE intent_id = ANY($1)',
          [intentIds]
        );

        // Delete related XCM message records
        await this.databaseProvider.query(
          'DELETE FROM xcm_messages WHERE intent_id = ANY($1)',
          [intentIds]
        );

        // Delete the intent records themselves
        await this.databaseProvider.query(
          'DELETE FROM intents WHERE id = ANY($1)',
          [intentIds]
        );
      }

      // Delete potentially affected agent records
      const affectedAgents = await this.databaseProvider.query(
        'SELECT address FROM agents WHERE registered_at >= $1',
        [reorgTimestamp.toString()]
      );

      if (affectedAgents.rows.length > 0) {
        const agentAddresses = affectedAgents.rows.map((row: any) => row.address);
        this.logger.log(`Deleting ${agentAddresses.length} potentially affected agents`);

        await this.databaseProvider.query(
          'DELETE FROM agents WHERE address = ANY($1)',
          [agentAddresses]
        );
      }

      this.logger.log(`Completed deletion of affected records from block ${fromBlock}`);
    } catch (error) {
      this.logger.error('Error deleting affected records during reorg:', error);
    }
  }

  // Utility methods for monitoring and maintenance
  async getIndexerStatus() {
    try {
      const lastBlock = await this.redisProvider.get('indexer:last_block');
      const provider = this.contractProvider.getProvider();
      const currentBlock = await provider.getBlockNumber();
      
      return {
        isIndexing: this.isIndexing,
        lastIndexedBlock: lastBlock ? parseInt(lastBlock) : null,
        currentChainBlock: currentBlock,
        blocksBehind: lastBlock ? currentBlock - parseInt(lastBlock) : null,
        hydrationConnected: this.hydrationApi?.isConnected || false,
        bifrostConnected: this.bifrostApi?.isConnected || false,
      };
    } catch (error) {
      this.logger.error('Error getting indexer status:', error);
      return {
        isIndexing: this.isIndexing,
        lastIndexedBlock: null,
        currentChainBlock: null,
        blocksBehind: null,
        hydrationConnected: false,
        bifrostConnected: false,
        error: (error as Error).message,
      };
    }
  }

  async forceReindex(fromBlock: number) {
    try {
      this.logger.log(`Force reindexing from block ${fromBlock}`);
      
      const provider = this.contractProvider.getProvider();
      const currentBlock = await provider.getBlockNumber();
      
      if (fromBlock > currentBlock) {
        throw new Error(`From block ${fromBlock} is greater than current block ${currentBlock}`);
      }

      // Delete records from the specified block onwards
      await this.deleteAffectedRecords(fromBlock);
      
      // Re-index from the specified block
      await this.catchUpBlocks(fromBlock, currentBlock);
      
      this.logger.log(`Force reindex completed from block ${fromBlock}`);
    } catch (error) {
      this.logger.error('Force reindex error:', error);
      throw error;
    }
  }

  async stopIndexing() {
    try {
      this.logger.log('Stopping indexer...');
      this.isIndexing = false;
      
      // Remove event listeners
      const provider = this.contractProvider.getProvider();
      provider.removeAllListeners('block');
      
      this.logger.log('Indexer stopped');
    } catch (error) {
      this.logger.error('Error stopping indexer:', error);
    }
  }

  async restartIndexing() {
    try {
      this.logger.log('Restarting indexer...');
      await this.stopIndexing();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.startIndexing();
      this.logger.log('Indexer restarted');
    } catch (error) {
      this.logger.error('Error restarting indexer:', error);
    }
  }

  private async processBlockEvents(blockNumber: number) {
    try {
      const provider = this.contractProvider.getProvider();
      
      // Get all logs for our contracts in this block
      const intentVaultAddress = await this.intentVaultContract.getAddress();
      const agentRegistryAddress = await this.agentRegistryContract.getAddress();
      const executionManagerAddress = await this.executionManagerContract.getAddress();

      const logs = await provider.getLogs({
        fromBlock: blockNumber,
        toBlock: blockNumber,
        address: [intentVaultAddress, agentRegistryAddress, executionManagerAddress]
      });

      this.logger.debug(`Processing ${logs.length} logs in block ${blockNumber}`);

      // Process each log
      for (const log of logs) {
        await this.processEventLog(log);
      }

    } catch (error) {
      this.logger.error('Block events processing error:', error);
    }
  }

  private async processEventLog(log: ethers.Log) {
    try {
      const intentVaultAddress = await this.intentVaultContract.getAddress();
      const agentRegistryAddress = await this.agentRegistryContract.getAddress();
      const executionManagerAddress = await this.executionManagerContract.getAddress();

      // Determine which contract emitted the event and parse accordingly
      if (log.address.toLowerCase() === intentVaultAddress.toLowerCase()) {
        await this.processIntentVaultEvent(log);
      } else if (log.address.toLowerCase() === agentRegistryAddress.toLowerCase()) {
        await this.processAgentRegistryEvent(log);
      } else if (log.address.toLowerCase() === executionManagerAddress.toLowerCase()) {
        await this.processExecutionManagerEvent(log);
      }
    } catch (error) {
      this.logger.error('Event log processing error:', error);
    }
  }

  private async processIntentVaultEvent(log: ethers.Log) {
    try {
      const parsedLog = this.intentVaultContract.interface.parseLog({
        topics: log.topics,
        data: log.data
      });

      if (!parsedLog) return;

      const { name, args } = parsedLog;

      switch (name) {
        case 'IntentCreated':
          await this.handleIntentCreated(args, log);
          break;
        case 'IntentAssigned':
          await this.handleIntentAssigned(args, log);
          break;
        case 'PlanSubmitted':
          await this.handlePlanSubmitted(args, log);
          break;
        case 'PlanApproved':
          await this.handlePlanApproved(args, log);
          break;
        case 'IntentExecuted':
          await this.handleIntentExecuted(args, log);
          break;
        case 'ExecutionCompleted':
          await this.handleExecutionCompleted(args, log);
          break;
        case 'ExecutionFailed':
          await this.handleExecutionFailed(args, log);
          break;
        case 'IntentCancelled':
          await this.handleIntentCancelled(args, log);
          break;
        case 'IntentExpired':
          await this.handleIntentExpired(args, log);
          break;
        default:
          this.logger.debug(`Unhandled IntentVault event: ${name}`);
      }
    } catch (error) {
      this.logger.error('IntentVault event processing error:', error);
    }
  }

  private async processAgentRegistryEvent(log: ethers.Log) {
    try {
      const parsedLog = this.agentRegistryContract.interface.parseLog({
        topics: log.topics,
        data: log.data
      });

      if (!parsedLog) return;

      const { name, args } = parsedLog;

      switch (name) {
        case 'AgentRegistered':
          await this.handleAgentRegistered(args, log);
          break;
        case 'ReputationUpdated':
          await this.handleReputationUpdated(args, log);
          break;
        case 'AgentSlashed':
          await this.handleAgentSlashed(args, log);
          break;
        case 'AgentDeactivated':
          await this.handleAgentDeactivated(args, log);
          break;
        default:
          this.logger.debug(`Unhandled AgentRegistry event: ${name}`);
      }
    } catch (error) {
      this.logger.error('AgentRegistry event processing error:', error);
    }
  }

  private async processExecutionManagerEvent(log: ethers.Log) {
    try {
      const parsedLog = this.executionManagerContract.interface.parseLog({
        topics: log.topics,
        data: log.data
      });

      if (!parsedLog) return;

      const { name, args } = parsedLog;

      switch (name) {
        case 'ExecutionStarted':
          await this.handleExecutionStarted(args, log);
          break;
        case 'ExecutionDispatched':
          await this.handleExecutionDispatched(args, log);
          break;
        case 'XCMSent':
          await this.handleXCMSent(args, log);
          break;
        default:
          this.logger.debug(`Unhandled ExecutionManager event: ${name}`);
      }
    } catch (error) {
      this.logger.error('ExecutionManager event processing error:', error);
    }
  }

  // IntentVault Event Handlers
  private async handleIntentCreated(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();
      const userAddress = args.user;
      const amount = args.amount.toString();
      const goalHash = args.goalHash;

      // Get full intent details from contract
      const intent = await this.contractService.getIntent(BigInt(intentId));

      // Insert into intents table
      await this.databaseProvider.query(`
        INSERT INTO intents (
          id, user_address, amount, goal_hash, max_slippage_bps, deadline,
          min_yield_bps, max_lock_duration, approved_protocols, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `, [
        intentId,
        userAddress,
        amount,
        goalHash,
        intent.maxSlippageBps.toString(),
        intent.deadline.toString(),
        intent.minYieldBps?.toString() || '0',
        intent.maxLockDuration?.toString() || '0',
        intent.approvedProtocols || [],
        'PENDING',
        intent.createdAt.toString(),
        Date.now().toString()
      ]);

      this.logger.log(`Intent created: ${intentId} by ${userAddress}`);
    } catch (error) {
      this.logger.error('IntentCreated handler error:', error);
    }
  }

  private async handleIntentAssigned(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();
      const agentAddress = args.agent;

      await this.databaseProvider.query(`
        UPDATE intents 
        SET assigned_agent = $1, status = $2, updated_at = $3
        WHERE id = $4
      `, [agentAddress, 'ASSIGNED', Date.now().toString(), intentId]);

      this.logger.log(`Intent ${intentId} assigned to agent ${agentAddress}`);
    } catch (error) {
      this.logger.error('IntentAssigned handler error:', error);
    }
  }

  private async handlePlanSubmitted(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();
      const planHash = args.planHash;

      await this.databaseProvider.query(`
        UPDATE intents 
        SET execution_plan_hash = $1, status = $2, updated_at = $3
        WHERE id = $4
      `, [planHash, 'PLAN_SUBMITTED', Date.now().toString(), intentId]);

      this.logger.log(`Plan submitted for intent ${intentId}`);
    } catch (error) {
      this.logger.error('PlanSubmitted handler error:', error);
    }
  }

  private async handlePlanApproved(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();

      await this.databaseProvider.query(`
        UPDATE intents 
        SET status = $1, updated_at = $2
        WHERE id = $3
      `, ['APPROVED', Date.now().toString(), intentId]);

      this.logger.log(`Plan approved for intent ${intentId}`);
    } catch (error) {
      this.logger.error('PlanApproved handler error:', error);
    }
  }

  private async handleIntentExecuted(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();

      await this.databaseProvider.query(`
        UPDATE intents 
        SET status = $1, updated_at = $2
        WHERE id = $3
      `, ['EXECUTING', Date.now().toString(), intentId]);

      // Broadcast WebSocket update
      this.websocketService.broadcastIntentUpdate(parseInt(intentId), 'EXECUTING');

      this.logger.log(`Intent ${intentId} execution started`);
    } catch (error) {
      this.logger.error('IntentExecuted handler error:', error);
    }
  }

  private async handleExecutionCompleted(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();
      const returnAmount = args.returnAmount?.toString() || '0';

      await this.databaseProvider.query(`
        UPDATE intents 
        SET status = $1, updated_at = $2
        WHERE id = $3
      `, ['COMPLETED', Date.now().toString(), intentId]);

      // Broadcast WebSocket update
      this.websocketService.broadcastExecutionComplete(parseInt(intentId), returnAmount);

      this.logger.log(`Intent ${intentId} completed with return amount ${returnAmount}`);
    } catch (error) {
      this.logger.error('ExecutionCompleted handler error:', error);
    }
  }

  private async handleExecutionFailed(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();
      const reason = args.reason || 'Unknown error';

      await this.databaseProvider.query(`
        UPDATE intents 
        SET status = $1, updated_at = $2
        WHERE id = $3
      `, ['FAILED', Date.now().toString(), intentId]);

      // Broadcast WebSocket update
      this.websocketService.broadcastExecutionFailed(parseInt(intentId), reason);

      this.logger.log(`Intent ${intentId} execution failed: ${reason}`);
    } catch (error) {
      this.logger.error('ExecutionFailed handler error:', error);
    }
  }

  private async handleIntentCancelled(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();

      await this.databaseProvider.query(`
        UPDATE intents 
        SET status = $1, updated_at = $2
        WHERE id = $3
      `, ['CANCELLED', Date.now().toString(), intentId]);

      this.logger.log(`Intent ${intentId} cancelled`);
    } catch (error) {
      this.logger.error('IntentCancelled handler error:', error);
    }
  }

  private async handleIntentExpired(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();

      await this.databaseProvider.query(`
        UPDATE intents 
        SET status = $1, updated_at = $2
        WHERE id = $3
      `, ['EXPIRED', Date.now().toString(), intentId]);

      this.logger.log(`Intent ${intentId} expired`);
    } catch (error) {
      this.logger.error('IntentExpired handler error:', error);
    }
  }

  // AgentRegistry Event Handlers
  private async handleAgentRegistered(args: any, log: ethers.Log) {
    try {
      const agentAddress = args.agent;
      const stakeAmount = args.stake.toString();
      const metadataURI = args.metadataURI;

      // Get full agent details from contract
      const agent = await this.contractService.getAgent(agentAddress);

      await this.databaseProvider.query(`
        INSERT INTO agents (
          address, stake_amount, reputation_score, success_count, fail_count,
          total_executions, is_active, metadata_uri, registered_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (address) DO NOTHING
      `, [
        agentAddress,
        stakeAmount,
        agent.reputationScore.toString(),
        agent.successCount.toString(),
        agent.failCount.toString(),
        agent.totalExecutions.toString(),
        agent.isActive,
        metadataURI,
        agent.registeredAt.toString(),
        Date.now().toString()
      ]);

      this.logger.log(`Agent registered: ${agentAddress} with stake ${stakeAmount}`);
    } catch (error) {
      this.logger.error('AgentRegistered handler error:', error);
    }
  }

  private async handleReputationUpdated(args: any, log: ethers.Log) {
    try {
      const agentAddress = args.agent;
      const newScore = args.newScore.toString();

      await this.databaseProvider.query(`
        UPDATE agents 
        SET reputation_score = $1, updated_at = $2
        WHERE address = $3
      `, [newScore, Date.now().toString(), agentAddress]);

      this.logger.log(`Agent ${agentAddress} reputation updated to ${newScore}`);
    } catch (error) {
      this.logger.error('ReputationUpdated handler error:', error);
    }
  }

  private async handleAgentSlashed(args: any, log: ethers.Log) {
    try {
      const agentAddress = args.agent;
      const slashAmount = args.slashAmount.toString();

      // Get current stake amount from contract
      const currentStake = await this.contractService.getAgentStake(agentAddress);

      await this.databaseProvider.query(`
        UPDATE agents 
        SET stake_amount = $1, updated_at = $2
        WHERE address = $3
      `, [currentStake.toString(), Date.now().toString(), agentAddress]);

      this.logger.log(`Agent ${agentAddress} slashed by ${slashAmount}`);
    } catch (error) {
      this.logger.error('AgentSlashed handler error:', error);
    }
  }

  private async handleAgentDeactivated(args: any, log: ethers.Log) {
    try {
      const agentAddress = args.agent;

      await this.databaseProvider.query(`
        UPDATE agents 
        SET is_active = false, updated_at = $1
        WHERE address = $2
      `, [Date.now().toString(), agentAddress]);

      this.logger.log(`Agent ${agentAddress} deactivated`);
    } catch (error) {
      this.logger.error('AgentDeactivated handler error:', error);
    }
  }

  // ExecutionManager Event Handlers
  private async handleExecutionStarted(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();
      const totalSteps = args.totalSteps.toString();

      await this.databaseProvider.query(`
        INSERT INTO executions (
          intent_id, status, total_steps, completed_steps, started_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (intent_id) DO UPDATE SET
          status = $2, total_steps = $3, started_at = $5
      `, [intentId, 'IN_PROGRESS', totalSteps, '0', Date.now().toString()]);

      // Broadcast WebSocket update with step progress
      this.websocketService.broadcastIntentUpdate(
        parseInt(intentId), 
        'IN_PROGRESS', 
        0, 
        parseInt(totalSteps)
      );

      this.logger.log(`Execution started for intent ${intentId} with ${totalSteps} steps`);
    } catch (error) {
      this.logger.error('ExecutionStarted handler error:', error);
    }
  }

  private async handleExecutionDispatched(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();

      await this.databaseProvider.query(`
        UPDATE intents 
        SET status = $1, updated_at = $2
        WHERE id = $3
      `, ['AWAITING_CONFIRMATION', Date.now().toString(), intentId]);

      await this.databaseProvider.query(`
        UPDATE executions 
        SET status = $1
        WHERE intent_id = $2
      `, ['AWAITING_CONFIRMATION', intentId]);

      this.logger.log(`Execution dispatched for intent ${intentId}`);
    } catch (error) {
      this.logger.error('ExecutionDispatched handler error:', error);
    }
  }

  private async handleXCMSent(args: any, log: ethers.Log) {
    try {
      const intentId = args.intentId.toString();
      const paraId = args.paraId.toString();
      const xcmMessageHash = args.xcmMessageHash;
      const xcmMessageBytes = args.xcmMessageBytes;

      // Store XCM message for confirmation polling
      await this.databaseProvider.query(`
        INSERT INTO xcm_messages (
          intent_id, para_id, xcm_message_hash, xcm_message_bytes, 
          status, dispatched_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        intentId,
        paraId,
        xcmMessageHash,
        xcmMessageBytes,
        'DISPATCHED',
        Date.now().toString()
      ]);

      // Broadcast WebSocket update
      this.websocketService.broadcastXCMSent(parseInt(intentId), parseInt(paraId), log.transactionHash);

      // Start polling for confirmation
      this.pollXCMConfirmation(parseInt(intentId), parseInt(paraId));

      this.logger.log(`XCM message sent for intent ${intentId} to parachain ${paraId}`);
    } catch (error) {
      this.logger.error('XCMSent handler error:', error);
    }
  }

  private async storeBlockInfo(blockNumber: number) {
    try {
      const provider = this.contractProvider.getProvider();
      const block = await provider.getBlock(blockNumber);
      
      if (block) {
        await this.databaseProvider.query(`
          INSERT INTO blocks (block_number, block_hash, timestamp, indexed_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (block_number) DO UPDATE SET
            block_hash = $2, timestamp = $3, indexed_at = $4
        `, [blockNumber, block.hash, block.timestamp, Date.now()]);
      }
    } catch (error) {
      this.logger.error('Store block info error:', error);
    }
  }

  private async catchUpBlocks(fromBlock: number, toBlock: number) {
    try {
      this.logger.log(`Catching up blocks ${fromBlock} to ${toBlock}`);

      for (let block = fromBlock; block <= toBlock; block++) {
        await this.processBlockEvents(block);
        await this.storeBlockInfo(block);
      }

      this.logger.log(`Finished catching up blocks ${fromBlock} to ${toBlock}`);
    } catch (error) {
      this.logger.error('Catch up blocks error:', error);
    }
  }

  async pollXCMConfirmation(intentId: number, paraId: number): Promise<boolean> {
    try {
      this.logger.log(`Starting XCM confirmation polling for intent ${intentId} on parachain ${paraId}`);

      // Get the XCM message details from database
      const xcmMessageResult = await this.databaseProvider.query(`
        SELECT * FROM xcm_messages 
        WHERE intent_id = $1 AND para_id = $2 AND status = 'DISPATCHED'
        ORDER BY dispatched_at DESC
        LIMIT 1
      `, [intentId.toString(), paraId.toString()]);

      if (xcmMessageResult.rows.length === 0) {
        this.logger.warn(`No dispatched XCM message found for intent ${intentId} on parachain ${paraId}`);
        return false;
      }

      const xcmMessage = xcmMessageResult.rows[0];
      const maxPollingAttempts = 60; // Poll for up to 10 minutes (every 10 seconds)
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        try {
          attempts++;
          
          if (attempts > maxPollingAttempts) {
            clearInterval(pollInterval);
            this.logger.warn(`XCM confirmation polling timeout for intent ${intentId} after ${maxPollingAttempts} attempts`);
            return;
          }

          const confirmed = await this.checkXCMConfirmationOnParachain(paraId, xcmMessage.xcm_message_hash);
          
          if (confirmed) {
            clearInterval(pollInterval);
            
            // Update XCM message status to CONFIRMED
            await this.databaseProvider.query(`
              UPDATE xcm_messages 
              SET status = $1, confirmed_at = $2
              WHERE intent_id = $3 AND para_id = $4
            `, ['CONFIRMED', Date.now().toString(), intentId.toString(), paraId.toString()]);

            // Call intentVault.completeIntent to finalize the execution
            await this.completeIntentExecution(intentId);

            this.logger.log(`XCM confirmed for intent ${intentId} on parachain ${paraId}`);
          }
        } catch (error) {
          this.logger.error(`XCM polling error for intent ${intentId}:`, error);
        }
      }, 10000); // Poll every 10 seconds

      return true;
    } catch (error) {
      this.logger.error('XCM confirmation polling error:', error);
      return false;
    }
  }

  private async checkXCMConfirmationOnParachain(paraId: number, xcmMessageHash: string): Promise<boolean> {
    try {
      let api: ApiPromise;

      // Select the appropriate parachain API
      switch (paraId) {
        case 2034: // Hydration
          api = this.hydrationApi;
          break;
        case 2030: // Bifrost
          api = this.bifrostApi;
          break;
        default:
          this.logger.warn(`Unsupported parachain ID for XCM confirmation: ${paraId}`);
          return false;
      }

      if (!api || !api.isConnected) {
        this.logger.warn(`Parachain ${paraId} API not connected`);
        return false;
      }

      // Query recent blocks for XCM execution events
      const currentBlockNumber = (await api.rpc.chain.getHeader()).number.toNumber();
      const fromBlock = Math.max(currentBlockNumber - 100, 1); // Check last 100 blocks

      // Query for XCM execution events
      // This is a simplified approach - in practice, you'd need to query specific XCM events
      // based on the parachain's implementation
      const blockHashes = await Promise.all(
        Array.from({ length: Math.min(10, currentBlockNumber - fromBlock) }, (_, i) => 
          api.rpc.chain.getBlockHash(currentBlockNumber - i)
        )
      );

      for (const blockHash of blockHashes) {
        const events = await api.query.system.events.at(blockHash) as any;
        
        for (const record of events) {
          const { event } = record;
          
          // Check for XCM execution events
          // This is parachain-specific and would need to be adapted for each parachain
          if (event.section === 'xcmpQueue' || event.section === 'dmpQueue' || event.section === 'xcmPallet') {
            if (event.method === 'Success' || event.method === 'Complete') {
              // In a real implementation, you'd need to match the XCM message hash
              // For now, we'll assume any XCM success event indicates our message was processed
              this.logger.debug(`Found XCM execution event in block ${blockHash}`);
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking XCM confirmation on parachain ${paraId}:`, error);
      return false;
    }
  }

  private async completeIntentExecution(intentId: number) {
    try {
      // In a real implementation, you would need to:
      // 1. Calculate the actual return amount from the parachain execution
      // 2. Call the IntentVault.completeIntent function with the return amount
      
      // For now, we'll simulate this by updating the database status
      // The actual contract call would be made by a privileged backend service
      
      this.logger.log(`Completing intent execution for intent ${intentId}`);
      
      // Update intent status to COMPLETED
      await this.databaseProvider.query(`
        UPDATE intents 
        SET status = $1, updated_at = $2
        WHERE id = $3
      `, ['COMPLETED', Date.now().toString(), intentId.toString()]);

      // Update execution status
      await this.databaseProvider.query(`
        UPDATE executions 
        SET status = $1, completed_at = $2
        WHERE intent_id = $3
      `, ['COMPLETED', Date.now().toString(), intentId.toString()]);

      // Broadcast WebSocket completion update
      this.websocketService.broadcastExecutionComplete(intentId, '0'); // Return amount would be calculated from parachain

      this.logger.log(`Intent ${intentId} execution completed successfully`);
    } catch (error) {
      this.logger.error(`Error completing intent execution for ${intentId}:`, error);
    }
  }
}