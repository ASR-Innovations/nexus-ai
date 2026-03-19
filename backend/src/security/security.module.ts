import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SharedModule } from '../shared/shared.module';
import { SecurityService } from '../shared/services/security.service';
import { TimelockManagerService } from '../shared/services/timelock-manager.service';
import { RateLimitService } from '../shared/services/rate-limit.service';
import { SlippageProtectionService } from '../shared/services/slippage-protection.service';
import { DeadlineManagementService } from '../shared/services/deadline-management.service';
import { ProtocolWhitelistService } from '../shared/services/protocol-whitelist.service';
import { XCMValidationService } from '../shared/services/xcm-validation.service';
import { SecurityConfigService } from '../shared/services/security-config.service';
import { SecurityMonitoringService } from '../shared/services/security-monitoring.service';
import { RBACService } from '../shared/services/rbac.service';
import { EncryptionService } from '../shared/services/encryption.service';
import { HSMService } from '../shared/services/hsm.service';
import { ActivityMonitorService } from '../shared/services/activity-monitor.service';

@Module({
  imports: [SharedModule],
  controllers: [SecurityController],
  providers: [
    SecurityService,
    TimelockManagerService,
    RateLimitService,
    SlippageProtectionService,
    DeadlineManagementService,
    ProtocolWhitelistService,
    XCMValidationService,
    SecurityConfigService,
    SecurityMonitoringService,
    RBACService,
    EncryptionService,
    HSMService,
    ActivityMonitorService,
  ],
  exports: [
    SecurityService,
    RBACService,
    EncryptionService,
    HSMService,
    ActivityMonitorService,
  ],
})
export class SecurityModule {}