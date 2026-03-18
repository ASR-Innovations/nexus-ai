import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';
import { SecurityError, SECURITY_ERRORS } from '../types/contract.types';

export interface XCMMessage {
  version: number;
  instructions: XCMInstruction[];
  destination: MultiLocation;
  beneficiary: MultiLocation;
  assets: MultiAsset[];
  signature?: string;
  timestamp?: number;
}

export interface XCMInstruction {
  type: string;
  data: Record<string, any>;
}

export interface MultiLocation {
  parents: number;
  interior: any;
}

export interface MultiAsset {
  id: AssetId;
  fun: Fungibility;
}

export interface AssetId {
  Concrete?: MultiLocation;
  Abstract?: string;
}

export interface Fungibility {
  Fungible?: string; // Changed from bigint to string for JSON serialization
  NonFungible?: any;
}

export interface XCMValidationResult {
  isValid: boolean;
  messageHash: string;
  estimatedWeight: bigint;
  estimatedFee: bigint;
  errors: SecurityError[];
  warnings: string[];
  auditLog: XCMAuditEntry;
}

export interface XCMAuditEntry {
  messageHash: string;
  timestamp: number;
  validationResult: 'VALID' | 'INVALID' | 'ERROR';
  errors: string[];
  warnings: string[];
  messageSize: number;
  processingTime: number;
}

export interface XCMAuthenticationResult {
  isAuthenticated: boolean;
  signatureValid: boolean;
  errors: SecurityError[];
  warnings: string[];
}

@Injectable()
export class XCMValidationService {
  private readonly logger = new Logger(XCMValidationService.name);
  private readonly auditLogKey = 'xcm_audit_log';
  private readonly validationCacheKey = 'xcm_validation_cache';
  private readonly cacheTTL = 300; // 5 minutes

  constructor(
    private redisService: RedisService,
    private configService: ConfigService
  ) {}

  /**
   * Validates XCM message structure and content
   * Requirements: 10.1 - XCM message structure validation
   */
  async validateXCMMessage(message: XCMMessage): Promise<XCMValidationResult> {
    const startTime = Date.now();
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    try {
      // Generate message hash for tracking
      const messageHash = this.generateMessageHash(message);

      // Check cache first
      const cached = await this.getCachedValidation(messageHash);
      if (cached) {
        return cached;
      }

      // Validate message structure
      const structureValidation = this.validateMessageStructure(message);
      errors.push(...structureValidation.errors);
      warnings.push(...structureValidation.warnings);

      // Validate instructions
      const instructionValidation = this.validateInstructions(message.instructions);
      errors.push(...instructionValidation.errors);
      warnings.push(...instructionValidation.warnings);

      // Validate destinations and assets
      const destinationValidation = this.validateDestination(message.destination);
      errors.push(...destinationValidation.errors);
      warnings.push(...destinationValidation.warnings);

      const assetValidation = this.validateAssets(message.assets);
      errors.push(...assetValidation.errors);
      warnings.push(...assetValidation.warnings);

      // Estimate weight and fees
      const { estimatedWeight, estimatedFee } = this.estimateExecutionCost(message);

      // Check weight limits
      if (estimatedWeight > 10000000000n) { // 10 billion weight units
        warnings.push(`High execution weight estimated: ${estimatedWeight}`);
      }

      const isValid = errors.length === 0;
      const processingTime = Date.now() - startTime;

      // Create audit log entry
      const auditLog: XCMAuditEntry = {
        messageHash,
        timestamp: Date.now(),
        validationResult: isValid ? 'VALID' : 'INVALID',
        errors: errors.map(e => e.message),
        warnings,
        messageSize: JSON.stringify(message).length,
        processingTime
      };

      // Store audit log
      await this.storeAuditLog(auditLog);

      const result: XCMValidationResult = {
        isValid,
        messageHash,
        estimatedWeight,
        estimatedFee,
        errors,
        warnings,
        auditLog
      };

      // Cache the result
      await this.cacheValidation(messageHash, result);

      return result;

    } catch (error) {
      this.logger.error('Failed to validate XCM message:', error);
      
      const processingTime = Date.now() - startTime;
      const messageHash = this.generateMessageHash(message);
      
      const auditLog: XCMAuditEntry = {
        messageHash,
        timestamp: Date.now(),
        validationResult: 'ERROR',
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        messageSize: JSON.stringify(message).length,
        processingTime
      };

      await this.storeAuditLog(auditLog);

      return {
        isValid: false,
        messageHash,
        estimatedWeight: 0n,
        estimatedFee: 0n,
        errors: [{
          code: 'XCM_VALIDATION_FAILED',
          message: 'Internal error during XCM validation',
          details: { error: error instanceof Error ? error.message : String(error) },
          retryable: true
        }],
        warnings: [],
        auditLog
      };
    }
  }

  /**
   * Verifies XCM message signatures and authenticity
   * Requirements: 10.2 - XCM signature verification and authentication
   */
  async authenticateXCMMessage(message: XCMMessage): Promise<XCMAuthenticationResult> {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    try {
      // Check if signature is present
      if (!message.signature) {
        errors.push({
          code: 'XCM_MISSING_SIGNATURE',
          message: 'XCM message is missing required signature',
          details: { messageHash: this.generateMessageHash(message) },
          retryable: false
        });
        
        return {
          isAuthenticated: false,
          signatureValid: false,
          errors,
          warnings
        };
      }

      // Validate signature format
      if (!this.isValidSignatureFormat(message.signature)) {
        errors.push({
          code: 'XCM_INVALID_SIGNATURE_FORMAT',
          message: 'XCM message signature has invalid format',
          details: { signature: message.signature },
          retryable: false
        });
        
        return {
          isAuthenticated: false,
          signatureValid: false,
          errors,
          warnings
        };
      }

      // Verify signature (mock implementation for development)
      const mockExternalApis = this.configService.get('app.development.mockExternalApis', false);
      
      let signatureValid: boolean;
      
      if (mockExternalApis) {
        // Mock signature validation - accept signatures starting with "0x"
        signatureValid = message.signature.startsWith('0x') && message.signature.length >= 130;
      } else {
        // Real signature validation would be implemented here
        signatureValid = await this.verifySignature(message);
      }

      if (!signatureValid) {
        errors.push({
          code: 'XCM_INVALID_SIGNATURE',
          message: 'XCM message signature verification failed',
          details: { 
            messageHash: this.generateMessageHash(message),
            signature: message.signature 
          },
          retryable: false
        });
      }

      // Additional authentication checks
      const timestampValid = this.validateTimestamp(message.timestamp);
      if (!timestampValid) {
        warnings.push('XCM message timestamp is outside acceptable range');
      }

      return {
        isAuthenticated: signatureValid && timestampValid,
        signatureValid,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error('Failed to authenticate XCM message:', error);
      return {
        isAuthenticated: false,
        signatureValid: false,
        errors: [{
          code: 'XCM_AUTHENTICATION_FAILED',
          message: 'Internal error during XCM authentication',
          details: { error: error instanceof Error ? error.message : String(error) },
          retryable: true
        }],
        warnings: []
      };
    }
  }

  /**
   * Validates XCM message structure
   */
  private validateMessageStructure(message: XCMMessage): { errors: SecurityError[]; warnings: string[] } {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    // Validate version
    if (typeof message.version !== 'number' || message.version < 0 || message.version > 3) {
      errors.push({
        code: 'XCM_INVALID_VERSION',
        message: `Invalid XCM version: ${message.version}. Must be 0-3`,
        details: { version: message.version },
        retryable: false
      });
    }

    // Validate instructions array
    if (!Array.isArray(message.instructions) || message.instructions.length === 0) {
      errors.push({
        code: 'XCM_INVALID_INSTRUCTIONS',
        message: 'XCM message must have at least one instruction',
        details: { instructionCount: message.instructions?.length || 0 },
        retryable: false
      });
    }

    // Validate destination
    if (!message.destination || typeof message.destination.parents !== 'number') {
      errors.push({
        code: 'XCM_INVALID_DESTINATION',
        message: 'XCM message destination is invalid or missing',
        details: { destination: message.destination },
        retryable: false
      });
    }

    // Validate assets
    if (!Array.isArray(message.assets)) {
      errors.push({
        code: 'XCM_INVALID_ASSETS',
        message: 'XCM message assets must be an array',
        details: { assets: message.assets },
        retryable: false
      });
    }

    // Check message size
    const messageSize = JSON.stringify(message).length;
    if (messageSize > 100000) { // 100KB limit
      warnings.push(`Large XCM message size: ${messageSize} bytes`);
    }

    return { errors, warnings };
  }

  /**
   * Validates XCM instructions
   */
  private validateInstructions(instructions: XCMInstruction[]): { errors: SecurityError[]; warnings: string[] } {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    const validInstructionTypes = [
      'WithdrawAsset',
      'ReserveAssetDeposited',
      'ReceiveTeleportedAsset',
      'QueryResponse',
      'TransferAsset',
      'TransferReserveAsset',
      'Transact',
      'HrmpNewChannelOpenRequest',
      'HrmpChannelAccepted',
      'HrmpChannelClosing',
      'ClearOrigin',
      'DescendOrigin',
      'ReportError',
      'DepositAsset',
      'DepositReserveAsset',
      'ExchangeAsset',
      'InitiateReserveWithdraw',
      'InitiateTeleport',
      'QueryHolding',
      'BuyExecution'
    ];

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];

      if (!instruction.type || typeof instruction.type !== 'string') {
        errors.push({
          code: 'XCM_INVALID_INSTRUCTION_TYPE',
          message: `Instruction ${i} has invalid or missing type`,
          details: { instructionIndex: i, instruction },
          retryable: false
        });
        continue;
      }

      if (!validInstructionTypes.includes(instruction.type)) {
        errors.push({
          code: 'XCM_UNKNOWN_INSTRUCTION_TYPE',
          message: `Unknown instruction type: ${instruction.type}`,
          details: { instructionIndex: i, type: instruction.type },
          retryable: false
        });
      }

      if (!instruction.data || typeof instruction.data !== 'object') {
        errors.push({
          code: 'XCM_INVALID_INSTRUCTION_DATA',
          message: `Instruction ${i} has invalid or missing data`,
          details: { instructionIndex: i, instruction },
          retryable: false
        });
      }
    }

    // Check for potentially dangerous instruction combinations
    const hasWithdraw = instructions.some(i => i.type === 'WithdrawAsset');
    const hasDeposit = instructions.some(i => i.type === 'DepositAsset');
    
    if (hasWithdraw && !hasDeposit) {
      warnings.push('XCM message withdraws assets but has no deposit instruction');
    }

    return { errors, warnings };
  }

  /**
   * Validates destination
   */
  private validateDestination(destination: MultiLocation): { errors: SecurityError[]; warnings: string[] } {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    if (destination.parents < 0 || destination.parents > 255) {
      errors.push({
        code: 'XCM_INVALID_DESTINATION_PARENTS',
        message: `Invalid destination parents: ${destination.parents}. Must be 0-255`,
        details: { parents: destination.parents },
        retryable: false
      });
    }

    // Validate interior (simplified validation)
    if (destination.interior && typeof destination.interior !== 'object') {
      errors.push({
        code: 'XCM_INVALID_DESTINATION_INTERIOR',
        message: 'Invalid destination interior format',
        details: { interior: destination.interior },
        retryable: false
      });
    }

    return { errors, warnings };
  }

  /**
   * Validates assets
   */
  private validateAssets(assets: MultiAsset[]): { errors: SecurityError[]; warnings: string[] } {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];

      if (!asset.id) {
        errors.push({
          code: 'XCM_INVALID_ASSET_ID',
          message: `Asset ${i} has missing or invalid ID`,
          details: { assetIndex: i, asset },
          retryable: false
        });
      }

      if (!asset.fun) {
        errors.push({
          code: 'XCM_INVALID_ASSET_FUNGIBILITY',
          message: `Asset ${i} has missing or invalid fungibility`,
          details: { assetIndex: i, asset },
          retryable: false
        });
      }

      // Validate fungible amounts
      if (asset.fun?.Fungible) {
        try {
          const amount = BigInt(asset.fun.Fungible);
          if (amount <= 0n) {
            errors.push({
              code: 'XCM_INVALID_ASSET_AMOUNT',
              message: `Asset ${i} has invalid fungible amount`,
              details: { assetIndex: i, amount: asset.fun.Fungible },
              retryable: false
            });
          }
        } catch (error) {
          errors.push({
            code: 'XCM_INVALID_ASSET_AMOUNT',
            message: `Asset ${i} has invalid fungible amount format`,
            details: { assetIndex: i, amount: asset.fun.Fungible },
            retryable: false
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Estimates execution cost
   */
  private estimateExecutionCost(message: XCMMessage): { estimatedWeight: bigint; estimatedFee: bigint } {
    // Simplified weight calculation
    let weight = 1000000n; // Base weight
    
    // Add weight per instruction
    weight += BigInt(message.instructions.length) * 500000n;
    
    // Add weight per asset
    weight += BigInt(message.assets.length) * 200000n;
    
    // Estimate fee (simplified)
    const estimatedFee = weight / 1000n; // 1 unit per 1000 weight units
    
    return { estimatedWeight: weight, estimatedFee };
  }

  /**
   * Verifies signature (mock implementation)
   */
  private async verifySignature(message: XCMMessage): Promise<boolean> {
    // In a real implementation, this would verify the signature against the message hash
    // using the appropriate cryptographic library
    return !!(message.signature?.startsWith('0x') && message.signature.length >= 130);
  }

  /**
   * Validates signature format
   */
  private isValidSignatureFormat(signature: string): boolean {
    return /^0x[a-fA-F0-9]{128,}$/.test(signature);
  }

  /**
   * Validates timestamp
   */
  private validateTimestamp(timestamp?: number): boolean {
    if (!timestamp) return true; // Optional field
    
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Accept timestamps within 5 minutes of current time
    return Math.abs(now - timestamp) <= fiveMinutes;
  }

  /**
   * Generates message hash
   */
  private generateMessageHash(message: XCMMessage): string {
    // Simplified hash generation - in production would use proper cryptographic hash
    const messageStr = JSON.stringify(message, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    );
    
    // Simple hash based on message content
    let hash = 0;
    for (let i = 0; i < messageStr.length; i++) {
      const char = messageStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  /**
   * Stores audit log entry
   * Requirements: 10.4 - XCM audit logging
   */
  private async storeAuditLog(auditLog: XCMAuditEntry): Promise<void> {
    try {
      const key = `${this.auditLogKey}:${auditLog.timestamp}:${auditLog.messageHash}`;
      await this.redisService.setex(key, 86400 * 7, JSON.stringify(auditLog)); // 7 days TTL
      
      // Also add to sorted set for easy querying
      await this.redisService.zadd('xcm_audit_by_time', auditLog.timestamp, key);
      
      this.logger.log(`Stored XCM audit log for message ${auditLog.messageHash}`);
    } catch (error) {
      this.logger.error('Failed to store XCM audit log:', error);
    }
  }

  /**
   * Caches validation result
   */
  private async cacheValidation(messageHash: string, result: XCMValidationResult): Promise<void> {
    try {
      const key = `${this.validationCacheKey}:${messageHash}`;
      await this.redisService.setex(key, this.cacheTTL, JSON.stringify(result));
    } catch (error) {
      this.logger.error('Failed to cache XCM validation result:', error);
    }
  }

  /**
   * Gets cached validation result
   */
  private async getCachedValidation(messageHash: string): Promise<XCMValidationResult | null> {
    try {
      const key = `${this.validationCacheKey}:${messageHash}`;
      const cached = await this.redisService.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to get cached XCM validation result:', error);
      return null;
    }
  }

  /**
   * Gets audit logs for monitoring
   */
  async getAuditLogs(hoursBack: number = 24, limit: number = 100): Promise<XCMAuditEntry[]> {
    try {
      const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
      
      const auditKeys = await this.redisService.zrangebyscore(
        'xcm_audit_by_time',
        cutoffTime,
        Date.now()
      );

      // Limit results
      const limitedKeys = auditKeys.slice(0, limit);

      const auditLogs: XCMAuditEntry[] = [];
      
      for (const key of limitedKeys) {
        try {
          const logData = await this.redisService.get(key);
          if (logData) {
            auditLogs.push(JSON.parse(logData));
          }
        } catch (error) {
          this.logger.error(`Failed to parse audit log ${key}:`, error);
        }
      }

      return auditLogs.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      this.logger.error('Failed to get XCM audit logs:', error);
      return [];
    }
  }

  /**
   * Gets validation statistics
   */
  async getValidationStatistics(hoursBack: number = 24): Promise<{
    totalValidations: number;
    validMessages: number;
    invalidMessages: number;
    errorMessages: number;
    averageProcessingTime: number;
    averageMessageSize: number;
  }> {
    try {
      const auditLogs = await this.getAuditLogs(hoursBack, 1000);
      
      const totalValidations = auditLogs.length;
      const validMessages = auditLogs.filter(log => log.validationResult === 'VALID').length;
      const invalidMessages = auditLogs.filter(log => log.validationResult === 'INVALID').length;
      const errorMessages = auditLogs.filter(log => log.validationResult === 'ERROR').length;
      
      const totalProcessingTime = auditLogs.reduce((sum, log) => sum + log.processingTime, 0);
      const totalMessageSize = auditLogs.reduce((sum, log) => sum + log.messageSize, 0);
      
      return {
        totalValidations,
        validMessages,
        invalidMessages,
        errorMessages,
        averageProcessingTime: totalValidations > 0 ? totalProcessingTime / totalValidations : 0,
        averageMessageSize: totalValidations > 0 ? totalMessageSize / totalValidations : 0
      };
    } catch (error) {
      this.logger.error('Failed to get XCM validation statistics:', error);
      return {
        totalValidations: 0,
        validMessages: 0,
        invalidMessages: 0,
        errorMessages: 0,
        averageProcessingTime: 0,
        averageMessageSize: 0
      };
    }
  }

  /**
   * Creates descriptive error messages for XCM validation failures
   * Requirements: 10.3 - XCM validation error handling with detailed messages
   */
  createXCMError(
    type: 'INVALID_STRUCTURE' | 'INVALID_SIGNATURE' | 'VALIDATION_FAILED' | 'AUTHENTICATION_FAILED',
    details: Record<string, any>
  ): SecurityError {
    switch (type) {
      case 'INVALID_STRUCTURE':
        return {
          code: 'XCM_INVALID_STRUCTURE',
          message: 'XCM message has invalid structure or format',
          details,
          retryable: false,
          suggestedAction: 'Check XCM message format and ensure all required fields are present'
        };
      
      case 'INVALID_SIGNATURE':
        return {
          code: 'XCM_INVALID_SIGNATURE',
          message: 'XCM message signature verification failed',
          details,
          retryable: false,
          suggestedAction: 'Verify the message signature and ensure it was signed correctly'
        };
      
      case 'VALIDATION_FAILED':
        return {
          code: 'XCM_VALIDATION_FAILED',
          message: 'XCM message validation failed',
          details,
          retryable: true,
          suggestedAction: 'Review the validation errors and correct the message format'
        };
      
      case 'AUTHENTICATION_FAILED':
        return {
          code: 'XCM_AUTHENTICATION_FAILED',
          message: 'XCM message authentication failed',
          details,
          retryable: true,
          suggestedAction: 'Ensure the message is properly signed and authenticated'
        };
      
      default:
        return {
          code: 'UNKNOWN_XCM_ERROR',
          message: 'Unknown XCM validation error',
          details,
          retryable: true
        };
    }
  }
}