import { Module, Global } from '@nestjs/common';
import { DatabaseProvider } from './database.provider';
import { RedisProvider } from './redis.provider';
import { ContractProvider } from './contract.provider';
import { ContractService } from './contract.service';
import { MigrationService } from './migration.service';
import { DatabaseInitService } from './database-init.service';
import { CacheService } from './cache.service';
import { DatabaseServiceImpl } from './database.service';
import { RequestDeduplicationService } from './services/request-deduplication.service';
import { WalletAuthGuard } from './guards/wallet-auth.guard';
import { TimelockRepositoryImpl } from './repositories/timelock.repository';
import { RedisService } from './redis.service';
import { PricingService } from './pricing.service';
import { StaticDataService } from './static-data.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Global()
@Module({
  providers: [
    DatabaseProvider, 
    RedisProvider, 
    ContractProvider,
    ContractService,
    MigrationService, 
    DatabaseInitService, 
    CacheService,
    DatabaseServiceImpl,
    RequestDeduplicationService,
    WalletAuthGuard,
    TimelockRepositoryImpl,
    RedisService,
    PricingService,
    StaticDataService,
    CircuitBreakerService,
  ],
  exports: [
    DatabaseProvider, 
    RedisProvider, 
    ContractProvider,
    ContractService,
    MigrationService, 
    DatabaseInitService, 
    CacheService,
    DatabaseServiceImpl,
    RequestDeduplicationService,
    WalletAuthGuard,
    TimelockRepositoryImpl,
    RedisService,
    PricingService,
    StaticDataService,
    CircuitBreakerService,
  ],
})
export class SharedModule {}