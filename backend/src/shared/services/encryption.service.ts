/**
 * Encryption Service
 * Handles data encryption at rest and in transit using industry-standard cryptography
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  authTag: string;
}

export interface DecryptionParams {
  encrypted: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);

  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 64;
  private readonly tagLength = 16;

  private encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.initializeEncryptionKey();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private initializeEncryptionKey(): void {
    const keyString = this.configService.get<string>('ENCRYPTION_KEY');
    
    if (!keyString) {
      this.logger.warn('No encryption key configured, generating temporary key');
      this.encryptionKey = crypto.randomBytes(this.keyLength);
      return;
    }

    // Derive key from configured string
    this.encryptionKey = crypto.scryptSync(keyString, 'salt', this.keyLength);
  }

  // ============================================================================
  // Encryption Operations
  // ============================================================================

  encrypt(plaintext: string): EncryptionResult {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(params: DecryptionParams): string {
    try {
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        Buffer.from(params.iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(params.authTag, 'hex'));

      let decrypted = decipher.update(params.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // ============================================================================
  // Object Encryption
  // ============================================================================

  encryptObject(obj: any): EncryptionResult {
    const plaintext = JSON.stringify(obj);
    return this.encrypt(plaintext);
  }

  decryptObject<T>(params: DecryptionParams): T {
    const plaintext = this.decrypt(params);
    return JSON.parse(plaintext) as T;
  }

  // ============================================================================
  // Hashing
  // ============================================================================

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  hashWithSalt(data: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(this.saltLength).toString('hex');
    const hash = crypto.createHash('sha256').update(data + actualSalt).digest('hex');
    
    return { hash, salt: actualSalt };
  }

  verifyHash(data: string, hash: string, salt: string): boolean {
    const computed = this.hashWithSalt(data, salt);
    return computed.hash === hash;
  }

  // ============================================================================
  // Key Derivation
  // ============================================================================

  deriveKey(password: string, salt: string): Buffer {
    return crypto.scryptSync(password, salt, this.keyLength);
  }

  generateSalt(): string {
    return crypto.randomBytes(this.saltLength).toString('hex');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  generateRandomKey(): string {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  generateRandomIV(): string {
    return crypto.randomBytes(this.ivLength).toString('hex');
  }
}
