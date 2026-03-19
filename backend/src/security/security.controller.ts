import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { SecurityService } from '../shared/services/security.service';
import { SecurityConfigService } from '../shared/services/security-config.service';
import { SecurityMonitoringService } from '../shared/services/security-monitoring.service';
import { RBACService, Role, Permission } from '../shared/services/rbac.service';

@Controller('security')
export class SecurityController {
  private readonly logger = new Logger(SecurityController.name);

  constructor(
    private readonly securityService: SecurityService,
    private readonly securityConfig: SecurityConfigService,
    private readonly securityMonitoring: SecurityMonitoringService,
    private readonly rbacService: RBACService,
  ) {}

  @Get('status')
  async getSecurityStatus() {
    try {
      return await this.securityService.getSecurityStatus();
    } catch (error) {
      this.logger.error('Failed to get security status:', error);
      throw error;
    }
  }

  @Get('metrics')
  async getSecurityMetrics() {
    try {
      return await this.securityService.getSecurityMetrics();
    } catch (error) {
      this.logger.error('Failed to get security metrics:', error);
      throw error;
    }
  }

  @Get('config')
  async getSecurityConfiguration() {
    try {
      return await this.securityConfig.getConfiguration();
    } catch (error) {
      this.logger.error('Failed to get security configuration:', error);
      throw error;
    }
  }

  @Post('config')
  async updateSecurityConfiguration(@Body() updates: any) {
    try {
      await this.securityConfig.updateConfiguration(updates);
      return { success: true, message: 'Security configuration updated successfully' };
    } catch (error) {
      this.logger.error('Failed to update security configuration:', error);
      throw error;
    }
  }

  @Post('config/reload')
  async reloadSecurityConfiguration() {
    try {
      await this.securityService.reloadSecurityConfiguration();
      return { success: true, message: 'Security configuration reloaded successfully' };
    } catch (error) {
      this.logger.error('Failed to reload security configuration:', error);
      throw error;
    }
  }

  @Post('config/validate')
  async validateSecurityConfiguration(@Body() config: any) {
    try {
      const validation = await this.securityService.validateSecurityConfiguration(config);
      return validation;
    } catch (error) {
      this.logger.error('Failed to validate security configuration:', error);
      throw error;
    }
  }

  @Get('config/default')
  async getDefaultSecurityConfiguration() {
    try {
      return await this.securityService.getDefaultSecurityConfiguration();
    } catch (error) {
      this.logger.error('Failed to get default security configuration:', error);
      throw error;
    }
  }

  @Get('agent/:address/reputation')
  async getAgentReputation(@Param('address') address: string) {
    try {
      const reputation = await this.securityService.validateAgentReputation(address, 0);
      const minThreshold = await this.securityConfig.getMinReputationThreshold();
      
      return {
        address,
        reputation: reputation ? 10000 : 0, // Simplified for now
        meetsThreshold: reputation,
        threshold: minThreshold
      };
    } catch (error) {
      this.logger.error(`Failed to get agent reputation for ${address}:`, error);
      throw error;
    }
  }

  @Get('agent/:address/rate-limit')
  async getAgentRateLimit(@Param('address') address: string) {
    try {
      const currentCount = await this.securityService.getCurrentAgentIntentCount(address);
      const maxCount = await this.securityConfig.getMaxActiveIntents();
      
      return {
        address,
        currentCount,
        maxCount,
        remaining: maxCount - currentCount,
        allowed: currentCount < maxCount,
        percentage: Math.round((currentCount / maxCount) * 100)
      };
    } catch (error) {
      this.logger.error(`Failed to get agent rate limit for ${address}:`, error);
      throw error;
    }
  }

  @Get('protocol/:address/whitelist')
  async checkProtocolWhitelist(@Param('address') address: string) {
    try {
      const isWhitelisted = await this.securityService.validateProtocolWhitelist([address]);
      
      return {
        protocol: address,
        whitelisted: isWhitelisted
      };
    } catch (error) {
      this.logger.error(`Failed to check protocol whitelist for ${address}:`, error);
      throw error;
    }
  }

  @Get('timelock/operations')
  async getTimelockOperations(@Query('status') status?: string) {
    try {
      if (status === 'pending') {
        return await this.securityService.timelockManager.listPendingOperations();
      } else if (status === 'ready') {
        return await this.securityService.timelockManager.listReadyOperations();
      } else {
        const [pending, ready] = await Promise.all([
          this.securityService.timelockManager.listPendingOperations(),
          this.securityService.timelockManager.listReadyOperations()
        ]);
        
        return {
          pending,
          ready,
          total: pending.length + ready.length
        };
      }
    } catch (error) {
      this.logger.error('Failed to get timelock operations:', error);
      throw error;
    }
  }

  @Get('timelock/operation/:id')
  async getTimelockOperation(@Param('id') id: string) {
    try {
      return await this.securityService.getTimelockStatus(id);
    } catch (error) {
      this.logger.error(`Failed to get timelock operation ${id}:`, error);
      throw error;
    }
  }

  @Post('validate')
  async validateSecurityConstraints(@Body() params: any) {
    try {
      return await this.securityService.validateSecurityConstraints(params);
    } catch (error) {
      this.logger.error('Failed to validate security constraints:', error);
      throw error;
    }
  }

  @Get('alerts')
  async getSecurityAlerts(@Query('limit') limit?: string, @Query('severity') severity?: string) {
    try {
      const alertLimit = limit ? parseInt(limit, 10) : 50;
      // Return empty array for now since getAlerts method doesn't exist
      return [];
    } catch (error) {
      this.logger.error('Failed to get security alerts:', error);
      throw error;
    }
  }

  @Post('alerts/:id/resolve')
  async resolveSecurityAlert(@Param('id') id: string) {
    try {
      // Use the existing resolveAlert method
      await this.securityMonitoring.resolveAlert(id);
      return { success: true, message: 'Alert resolved successfully' };
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${id}:`, error);
      throw error;
    }
  }

  @Get('health')
  async getSecurityHealth() {
    try {
      const status = await this.securityService.getSecurityStatus();
      const metrics = await this.securityService.getSecurityMetrics();
      
      return {
        healthy: !status.emergencyPaused && status.systemHealth.rateLimitingActive,
        status,
        metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get security health:', error);
      return {
        healthy: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ==================== RBAC ENDPOINTS ====================

  @Post('rbac/assign')
  async assignRole(@Body() body: { address: string; role: Role; assignedBy: string }) {
    try {
      this.rbacService.assignRole(body.address, body.role, body.assignedBy);
      return { success: true, message: 'Role assigned successfully' };
    } catch (error) {
      this.logger.error('Failed to assign role:', error);
      throw error;
    }
  }

  @Post('rbac/revoke')
  async revokeRole(@Body() body: { address: string }) {
    try {
      this.rbacService.revokeRole(body.address);
      return { success: true, message: 'Role revoked successfully' };
    } catch (error) {
      this.logger.error('Failed to revoke role:', error);
      throw error;
    }
  }

  @Get('rbac/user/:address')
  async getUserRole(@Param('address') address: string) {
    try {
      const userRole = this.rbacService.getUserRole(address);
      return userRole || { message: 'No role assigned' };
    } catch (error) {
      this.logger.error(`Failed to get user role for ${address}:`, error);
      throw error;
    }
  }

  @Post('rbac/check')
  async checkPermission(@Body() body: { address: string; permission: Permission }) {
    try {
      const result = this.securityService.checkAccess(body.address, body.permission);
      return result;
    } catch (error) {
      this.logger.error('Failed to check permission:', error);
      throw error;
    }
  }

  @Get('rbac/roles')
  async getAllRoles() {
    try {
      return this.rbacService.getAllRoles();
    } catch (error) {
      this.logger.error('Failed to get all roles:', error);
      throw error;
    }
  }

  @Get('rbac/statistics')
  async getRoleStatistics() {
    try {
      return this.rbacService.getRoleStatistics();
    } catch (error) {
      this.logger.error('Failed to get role statistics:', error);
      throw error;
    }
  }

  // ==================== ENCRYPTION ENDPOINTS ====================

  @Post('encryption/encrypt')
  async encryptData(@Body() body: { plaintext: string }) {
    try {
      const result = this.securityService.encryptData(body.plaintext);
      return { success: true, result };
    } catch (error) {
      this.logger.error('Failed to encrypt data:', error);
      throw error;
    }
  }

  @Post('encryption/decrypt')
  async decryptData(@Body() body: { encrypted: string; iv: string; authTag: string }) {
    try {
      const plaintext = this.securityService.decryptData(body);
      return { success: true, plaintext };
    } catch (error) {
      this.logger.error('Failed to decrypt data:', error);
      throw error;
    }
  }

  @Post('encryption/hash')
  async hashData(@Body() body: { data: string }) {
    try {
      const hash = this.securityService.hashData(body.data);
      return { success: true, hash };
    } catch (error) {
      this.logger.error('Failed to hash data:', error);
      throw error;
    }
  }

  // ==================== HSM ENDPOINTS ====================

  @Get('hsm/status')
  async getHSMStatus() {
    try {
      return this.securityService.getHSMStatus();
    } catch (error) {
      this.logger.error('Failed to get HSM status:', error);
      throw error;
    }
  }

  @Post('hsm/sign')
  async signWithHSM(@Body() body: { transactionHash: string }) {
    try {
      const result = await this.securityService.signTransactionWithHSM(body.transactionHash);
      return { success: true, result };
    } catch (error) {
      this.logger.error('Failed to sign with HSM:', error);
      throw error;
    }
  }

  // ==================== ACTIVITY MONITORING ENDPOINTS ====================

  @Get('activity/suspicious')
  async getSuspiciousAddresses() {
    try {
      return this.securityService.getSuspiciousAddresses();
    } catch (error) {
      this.logger.error('Failed to get suspicious addresses:', error);
      throw error;
    }
  }

  @Get('activity/frozen')
  async getFrozenAccounts() {
    try {
      return this.securityService.activityMonitor.listFrozenAccounts();
    } catch (error) {
      this.logger.error('Failed to get frozen accounts:', error);
      throw error;
    }
  }

  @Post('activity/freeze')
  async freezeAccount(@Body() body: { address: string; reason: string; frozenBy: string }) {
    try {
      this.securityService.freezeAccount(body.address, body.reason, body.frozenBy);
      return { success: true, message: 'Account frozen successfully' };
    } catch (error) {
      this.logger.error('Failed to freeze account:', error);
      throw error;
    }
  }

  @Post('activity/unfreeze')
  async unfreezeAccount(@Body() body: { address: string }) {
    try {
      this.securityService.unfreezeAccount(body.address);
      return { success: true, message: 'Account unfrozen successfully' };
    } catch (error) {
      this.logger.error('Failed to unfreeze account:', error);
      throw error;
    }
  }

  @Get('activity/blacklist')
  async getBlacklist() {
    try {
      return this.securityService.activityMonitor.getBlacklist();
    } catch (error) {
      this.logger.error('Failed to get blacklist:', error);
      throw error;
    }
  }

  @Post('activity/blacklist/add')
  async addToBlacklist(@Body() body: { address: string }) {
    try {
      this.securityService.addToBlacklist(body.address);
      return { success: true, message: 'Address added to blacklist' };
    } catch (error) {
      this.logger.error('Failed to add to blacklist:', error);
      throw error;
    }
  }

  @Post('activity/blacklist/remove')
  async removeFromBlacklist(@Body() body: { address: string }) {
    try {
      this.securityService.activityMonitor.removeFromBlacklist(body.address);
      return { success: true, message: 'Address removed from blacklist' };
    } catch (error) {
      this.logger.error('Failed to remove from blacklist:', error);
      throw error;
    }
  }

  @Get('activity/statistics')
  async getActivityStatistics() {
    try {
      return this.securityService.activityMonitor.getStatistics();
    } catch (error) {
      this.logger.error('Failed to get activity statistics:', error);
      throw error;
    }
  }

  @Get('activity/:address/history')
  async getActivityHistory(@Param('address') address: string, @Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : undefined;
      return this.securityService.activityMonitor.getActivityHistory(address, limitNum);
    } catch (error) {
      this.logger.error(`Failed to get activity history for ${address}:`, error);
      throw error;
    }
  }
}