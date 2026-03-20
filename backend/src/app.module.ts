import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { IntentModule } from './intent/intent.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { AgentsModule } from './agents/agents.module';
import { AgentBotModule } from './agents/bot/agent-bot.module';
import { StrategyModule } from './strategy/strategy.module';
import { ExecutionModule } from './execution/execution.module';
import { IndexerModule } from './indexer/indexer.module';
import { WebsocketModule } from './websocket/websocket.module';
import { MemoryModule } from './memory/memory.module';
import { SecurityModule } from './security/security.module';
import { SharedModule } from './shared/shared.module';
import { HealthModule } from './health/health.module';
import { WalletThrottlerGuard } from './shared/guards/wallet-throttler.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Scheduling for background jobs
    ScheduleModule.forRoot(),
    
    // Rate limiting with Redis storage
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Create Redis client for throttling
        const redis = new Redis({
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_THROTTLE_DB', 1), // Use separate DB for throttling
          keyPrefix: 'throttle:',
        });

        return {
          throttlers: [
            {
              name: 'chat',
              ttl: 60000, // 1 minute
              limit: 30,  // 30 requests per minute for chat
            },
            {
              name: 'intent',
              ttl: 60000, // 1 minute
              limit: 5,   // 5 requests per minute for intent creation
            },
            {
              name: 'portfolio',
              ttl: 60000, // 1 minute
              limit: 20,  // 20 requests per minute for portfolio queries
            },
            {
              name: 'default',
              ttl: 60000, // 1 minute
              limit: 100, // 100 requests per minute for other endpoints
            },
          ],
          storage: new ThrottlerStorageRedisService(redis),
        };
      },
    }),
    
    // Shared providers
    SharedModule,
    
    // Feature modules
    AuthModule,
    ChatModule,
    IntentModule,
    PortfolioModule,
    AgentsModule,
    AgentBotModule,
    StrategyModule,
    ExecutionModule,
    IndexerModule,
    WebsocketModule,
    MemoryModule,
    SecurityModule,
    HealthModule,
  ],
  providers: [
    // Global throttler guard with wallet address tracking
    {
      provide: APP_GUARD,
      useClass: WalletThrottlerGuard,
    },
  ],
})
export class AppModule {}