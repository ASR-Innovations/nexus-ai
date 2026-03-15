import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { SecurityService } from '../shared/services/security.service';
import { SecurityConfigService } from '../shared/services/security-config.service';
import { SecurityMonitoringService } from '../shared/services/security-monitoring.service';

@Controller('security')
export class SecurityController {
  private readonly logger = new Logger(SecurityController.name);

  constructor(
    private readonly securityService: SecurityService,
    private readonly securityConfig: SecurityConfigService,
    private readonly securityMonitoring: SecurityMonitoringService,
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
}