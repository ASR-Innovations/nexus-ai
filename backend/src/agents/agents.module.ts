import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { SharedModule } from '../shared/shared.module';
import { SecurityModule } from '../security/security.module';

// Bot services
import { AgentBotService } from './bot/agent-bot.service';
import { AgentBotController } from './bot/agent-bot.controller';
import { MonitoringService } from './bot/monitoring.service';
import { ExecutionEngineService } from './bot/execution-engine.service';
import { ProtocolIntegrationService } from './bot/protocol-integration.service';
import { ErrorHandlerService } from './bot/error-handler.service';
import { RealProtocolIntegrationService } from './bot/real-protocol-integration.service';
import { DashboardService } from './bot/dashboard.service';
import { WalletManagerService } from './bot/wallet-manager.service';
import { TransactionBuilderService } from './bot/transaction-builder.service';
import { FundManagerService } from './bot/fund-manager.service';
import { XCMExecutorService } from './bot/xcm-executor.service';
import { CallDataEncoderService } from './bot/call-data-encoder.service';
import { ErrorHandlingService } from './bot/error-handling.service';

@Module({
  imports: [
    SharedModule,
    SecurityModule,
    ConfigModule,
  ],
  controllers: [
    AgentsController,
    AgentBotController,
  ],
  providers: [
    AgentsService,
    // Core wallet and transaction services
    WalletManagerService,
    TransactionBuilderService,
    FundManagerService,
    XCMExecutorService,
    CallDataEncoderService,
    // Bot services
    AgentBotService,
    MonitoringService,
    ExecutionEngineService,
    ProtocolIntegrationService,
    ErrorHandlerService,
    ErrorHandlingService,
    RealProtocolIntegrationService,
    DashboardService,
  ],
  exports: [
    AgentsService,
    // Export core services for use in other modules
    WalletManagerService,
    TransactionBuilderService,
    FundManagerService,
    XCMExecutorService,
    CallDataEncoderService,
    // Export bot services
    AgentBotService,
    MonitoringService,
    ExecutionEngineService,
    ProtocolIntegrationService,
    ErrorHandlerService,
    ErrorHandlingService,
    RealProtocolIntegrationService,
    DashboardService,
  ],
})
export class AgentsModule {}