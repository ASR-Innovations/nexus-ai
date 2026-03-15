import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractService } from './contract.service';
import { TimelockService } from './timelock.service';
import { RedisService } from './redis.service';
import { SlippageProtectionService } from './services/slippage-protection.service';
import { DeadlineManagementService } from './services/deadline-management.service';
import { XCMValidationService } from './services/xcm-validation.service';
import { SecurityError, SECURITY_ERRORS } from './types/contract.types';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private contractService: ContractService,
    private timelockService: TimelockService,
    private redisService: RedisService,
    private configService: ConfigService,
    private slippageProtectionService: SlippageProtectionService,
    private deadlineManagementService: DeadlineManagementService,
    private xcmValidationService: XCMValidationService
  ) {}

  // Rate Limiting
  async checkAgentRateLimit(agentAddress: string): Promise<boolean> {
    try {
      const activeCount = await this.contractService.getAgentActiveIntentCount(agentAddress);
      const maxActive = await this.contractService.getMaxActiveIntentsPerAgent();
      return activeCount < Number(maxActive);
    } catch (error) {
      this.logger.error(`Failed to check rate limit for agent ${agentAddress}:`, error);
      return false;
    }
  }

  async incrementAgentIntentCount(agentAddress: string): Promise<void> {
    const key = `agent_intent_count:${agentAddress}`;
    await this.redisService.incr(key);
    await this.redisService.expire(key, 3600); // 1 hour TTL
  }

  async decrementAgentIntentCount(agentAddress: string): Promise<void> {
    const key = `agent_intent_count:${agentAddress}`;
    const current = await this.redisService.get(key);
    if (current && parseInt(current) > 0) {
      await this.redisService.decr(key);
    }
  }

  // Emergency Pause Detection
  async isEmergencyPaused(): Promise<boolean> {
    try {
      const [intentVaultPaused, agentRegistryPaused, executionManagerPaused] = await Promise.all([
        this.contractService.isPaused('intentVault'),
        this.contractService.isPaused('agentRegistry'),
        this.contractService.isPaused('executionManager')
      ]);

      return intentVaultPaused || agentRegistryPaused || executionManagerPaused;
    } catch (error) {
      this.logger.error('Failed to check emergency pause status:', error);
      return false;
    }
  }

  // Reputation Validation
  async validateAgentReputation(agentAddress: string, minThreshold: number = 3000): Promise<boolean> {
    try {
      const reputation = await this.contractService.getAgentReputationScore(agentAddress);
      return reputation >= minThreshold;
    } catch (error) {
      this.logger.error(`Failed to validate reputation for agent ${agentAddress}:`, error);
      return false;
    }
  }

  // Protocol Validation
  async validateProtocolWhitelist(protocols: string[]): Promise<boolean> {
    try {
      for (const protocol of protocols) {
        const isWhitelisted = await this.contractService.isProtocolWhitelisted(protocol);
        if (!isWhitelisted) {
          return false;
        }
      }
      return true;
    } catch (error) {
      this.logger.error('Failed to validate protocol whitelist:', error);
      return false;
    }
  }

  // Slippage Protection
  async validateSlippageProtection(params: {
    maxSlippageBps: number;
    returnAmount: bigint;
    executionAmount: bigint;
  }): Promise<boolean> {
    try {
      const validation = await this.slippageProtectionService.validateSlippageParameters(params);
      return validation.isValid;
    } catch (error) {
      this.logger.error('Failed to validate slippage protection:', error);
      return false;
    }
  }

  async enforceSlippageLimit(params: {
    maxSlippageBps: number;
    returnAmount: bigint;
    executionAmount: bigint;
  }): Promise<boolean> {
    return this.slippageProtectionService.enforceSlippageLimit(params);
  }

  async calculateDynamicSlippage(executionAmount: bigint): Promise<number> {
    return this.slippageProtectionService.calculateDynamicSlippage(executionAmount);
  }

  // Deadline Management
  async validateExecutionDeadline(deadline: number, bufferSeconds?: number): Promise<boolean> {
    try {
      const validation = await this.deadlineManagementService.validateExecutionDeadline(deadline);
      return validation.isValid;
    } catch (error) {
      this.logger.error('Failed to validate execution deadline:', error);
      return false;
    }
  }

  async applySafetyMarginToDeadline(deadline: number): Promise<number> {
    try {
      const result = await this.deadlineManagementService.applySafetyMargin(deadline);
      return result.adjustedDeadline;
    } catch (error) {
      this.logger.error('Failed to apply safety margin to deadline:', error);
      return deadline;
    }
  }

  async prioritizeIntentsByDeadline(intentIds: bigint[]) {
    return this.deadlineManagementService.prioritizeIntentsByDeadline(intentIds);
  }

  async handleDeadlineTimeout(intentId: bigint) {
    return this.deadlineManagementService.handleDeadlineTimeout(intentId);
  }

  // XCM Validation
  async validateXCMMessage(params: {
    paraId: number;
    beneficiary: string;
    amount: bigint;
  }): Promise<{ isValid: boolean; errors: SecurityError[] }> {
    try {
      // Create a simplified XCM message for validation
      const xcmMessage = {
        version: 2,
        instructions: [
          {
            type: 'WithdrawAsset',
            data: {
              assets: [{
                id: { Concrete: { parents: 1, interior: 'Here' } },
                fun: { Fungible: params.amount.toString() }
              }]
            }
          }
        ],
        destination: {
          parents: 1,
          interior: { X1: { Parachain: params.paraId } }
        },
        beneficiary: {
          parents: 0,
          interior: { X1: { AccountId32: { network: 'Any', id: params.beneficiary } } }
        },
        assets: [{
          id: { Concrete: { parents: 1, interior: 'Here' } },
          fun: { Fungible: params.amount.toString() }
        }]
      };

      const validation = await this.xcmValidationService.validateXCMMessage(xcmMessage);
      
      return {
        isValid: validation.isValid,
        errors: validation.errors
      };
    } catch (error) {
      this.logger.error('XCM validation failed:', error);
      return {
        isValid: false,
        errors: [{
          code: 'XCM_VALIDATION_FAILED',
          message: 'Internal error during XCM validation',
          details: { error: error instanceof Error ? error.message : String(error) },
          retryable: true
        }]
      };
    }
  }

  // Security Error Handling
  createSecurityError(errorType: keyof typeof SECURITY_ERRORS, details?: Record<string, any>): SecurityError {
    const baseError = SECURITY_ERRORS[errorType];
    return {
      ...baseError,
      details: details || {}
    };
  }

  // Comprehensive Security Check
  async performSecurityCheck(params: {
    agentAddress: string;
    intentId?: bigint;
    protocols?: string[];
    slippage?: { maxSlippageBps: number; returnAmount: bigint; executionAmount: bigint };
    deadline?: number;
    xcm?: { paraId: number; beneficiary: string; amount: bigint };
  }): Promise<{ isValid: boolean; errors: SecurityError[] }> {
    const errors: SecurityError[] = [];

    try {
      // Check emergency pause
      if (await this.isEmergencyPaused()) {
        errors.push(this.createSecurityError('EMERGENCY_PAUSE_ACTIVE'));
        return { isValid: false, errors }; // Stop here if paused
      }

      // Check rate limiting
      if (!(await this.checkAgentRateLimit(params.agentAddress))) {
        errors.push(this.createSecurityError('RATE_LIMIT_EXCEEDED', { agentAddress: params.agentAddress }));
      }

      // Check reputation
      if (!(await this.validateAgentReputation(params.agentAddress))) {
        errors.push(this.createSecurityError('INSUFFICIENT_REPUTATION', { agentAddress: params.agentAddress }));
      }

      // Check protocol whitelist
      if (params.protocols && !(await this.validateProtocolWhitelist(params.protocols))) {
        errors.push(this.createSecurityError('PROTOCOL_NOT_WHITELISTED', { protocols: params.protocols }));
      }

      // Check slippage protection
      if (params.slippage) {
        const slippageValid = await this.validateSlippageProtection(params.slippage);
        if (!slippageValid) {
          const slippageValidation = await this.slippageProtectionService.validateSlippageParameters(params.slippage);
          errors.push(...slippageValidation.errors);
        }
      }

      // Check deadline buffer
      if (params.deadline) {
        const deadlineValid = await this.validateExecutionDeadline(params.deadline);
        if (!deadlineValid) {
          const deadlineValidation = await this.deadlineManagementService.validateExecutionDeadline(params.deadline);
          errors.push(...deadlineValidation.errors);
        }
      }

      // Check XCM validation
      if (params.xcm) {
        const xcmValidation = await this.validateXCMMessage(params.xcm);
        if (!xcmValidation.isValid) {
          errors.push(...xcmValidation.errors);
        }
      }

    } catch (error) {
      this.logger.error('Security check failed:', error);
      errors.push({
        code: 'SECURITY_CHECK_FAILED',
        message: 'Internal security validation error',
        details: { error: error instanceof Error ? error.message : String(error) },
        retryable: true
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}