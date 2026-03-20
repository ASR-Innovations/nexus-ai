/**
 * Agent Bot Module
 * Wires together all real protocol execution services
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SharedModule } from '../../shared/shared.module';
import { SecurityModule } from '../../security/security.module';

// Bot Services
import { WalletManagerService } from './wallet-manager.service';
import { CallDataEncoderService } from './call-data-encoder.service';
import { TransactionBuilderService } from './transaction-builder.service';
import { XCMExecutorService } from './xcm-executor.service';
import { FundManagerService } from './fund-manager.service';
import { ProtocolIntegrationService } from './protocol-integration.service';
import { RealProtocolIntegrationService } from './real-protocol-integration.service';
import { ExecutionEngineService } from './execution-engine.service';
import { ErrorHandlingService } from './error-handling.service';
import { MonitoringService } from './monitoring.service';
import { DashboardService } from './dashboard.service';
import { ProductionBotService } from './production-bot.service';
import { AgentBotController } from './agent-bot.controller';
import { AgentBotService } from './agent-bot.service';

// Performance optimization services
import { ExecutionQueueService } from './execution-queue.service';
import { ProtocolCacheService } from './protocol-cache.service';
import { RpcConnectionPoolService } from './rpc-connection-pool.service';
import { BatchProcessorService } from './batch-processor.service';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    SharedModule,
    SecurityModule,
  ],
  controllers: [AgentBotController],
  providers: [
    // Core wallet and transaction services
    WalletManagerService,
    CallDataEncoderService,
    TransactionBuilderService,
    XCMExecutorService,
    
    // Fund and protocol services
    FundManagerService,
    ProtocolIntegrationService,
    RealProtocolIntegrationService,
    
    // Execution and error handling
    ExecutionEngineService,
    ErrorHandlingService,
    
    // Monitoring
    MonitoringService,
    DashboardService,
    
    // Performance optimization services
    ExecutionQueueService,
    ProtocolCacheService,
    RpcConnectionPoolService,
    BatchProcessorService,
    
    // Production bot (24/7 autonomous operation)
    ProductionBotService,
    
    // Main bot service
    AgentBotService,
  ],
  exports: [
    WalletManagerService,
    TransactionBuilderService,
    FundManagerService,
    ExecutionEngineService,
    MonitoringService,
    ProductionBotService,
    ExecutionQueueService,
    ProtocolCacheService,
    RpcConnectionPoolService,
    BatchProcessorService,
  ],
})
export class AgentBotModule {}
