/**
 * Wallet Manager Service
 * Secure wallet and keyring management for EVM and Substrate chains
 * Handles transaction signing with support for multiple wallet types
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import { cryptoWaitReady } from '@polkadot/util-crypto';

export interface WalletConfig {
  // EVM wallets
  evmPrivateKey?: string;
  evmMnemonic?: string;
  
  // Substrate wallets
  substrateMnemonic?: string;
  substratePrivateKey?: string;
  
  // Multi-sig configuration
  multiSigEnabled: boolean;
  multiSigThreshold?: number;
  multiSigSigners?: string[];
  
  // Security
  encryptionEnabled: boolean;
  kmsEnabled: boolean;
  kmsKeyId?: string;
}

@Injectable()
export class WalletManagerService implements OnModuleInit {
  private readonly logger = new Logger(WalletManagerService.name);

  // EVM wallets
  private evmWallets: Map<string, ethers.Wallet> = new Map();
  private defaultEvmWallet?: ethers.Wallet;

  // Substrate wallets
  private substrateKeyring?: Keyring;
  private substrateAccounts: Map<string, KeyringPair> = new Map();
  private defaultSubstrateAccount?: KeyringPair;

  // Multi-sig wallets
  private multiSigWallets: Map<string, {
    threshold: number;
    signers: string[];
    pendingTxs: Map<string, { signatures: string[]; data: any }>;
  }> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.logger.log('Initializing Wallet Manager');

    try {
      // Wait for crypto libraries to be ready
      await cryptoWaitReady();

      // Initialize wallets from configuration
      await this.initializeWallets();

      this.logger.log('Wallet Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Wallet Manager', error);
      throw error;
    }
  }

  // ============================================================================
  // Wallet Initialization
  // ============================================================================

  private async initializeWallets(): Promise<void> {
    const config = this.getWalletConfig();

    // Initialize EVM wallets
    if (config.evmPrivateKey) {
      await this.initializeEVMWalletFromPrivateKey(config.evmPrivateKey);
    } else if (config.evmMnemonic) {
      await this.initializeEVMWalletFromMnemonic(config.evmMnemonic);
    }

    // Initialize Substrate wallets
    if (config.substrateMnemonic) {
      await this.initializeSubstrateWalletFromMnemonic(config.substrateMnemonic);
    }

    // Initialize multi-sig if enabled
    if (config.multiSigEnabled && config.multiSigSigners) {
      this.initializeMultiSig(config.multiSigSigners, config.multiSigThreshold || 2);
    }
  }

  private async initializeEVMWalletFromPrivateKey(privateKey: string): Promise<void> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      this.defaultEvmWallet = wallet;
      this.evmWallets.set('default', wallet);

      this.logger.log('EVM wallet initialized from private key', {
        address: wallet.address,
      });
    } catch (error) {
      this.logger.error('Failed to initialize EVM wallet from private key', error);
      throw error;
    }
  }

  private async initializeEVMWalletFromMnemonic(mnemonic: string): Promise<void> {
    try {
      const wallet = ethers.Wallet.fromPhrase(mnemonic);
      this.defaultEvmWallet = wallet;
      this.evmWallets.set('default', wallet);

      this.logger.log('EVM wallet initialized from mnemonic', {
        address: wallet.address,
      });
    } catch (error) {
      this.logger.error('Failed to initialize EVM wallet from mnemonic', error);
      throw error;
    }
  }

  private async initializeSubstrateWalletFromMnemonic(mnemonic: string): Promise<void> {
    try {
      this.substrateKeyring = new Keyring({ type: 'sr25519' });
      const account = this.substrateKeyring.addFromUri(mnemonic);
      
      this.defaultSubstrateAccount = account;
      this.substrateAccounts.set('default', account);

      this.logger.log('Substrate wallet initialized from mnemonic', {
        address: account.address,
      });
    } catch (error) {
      this.logger.error('Failed to initialize Substrate wallet', error);
      throw error;
    }
  }

  private initializeMultiSig(signers: string[], threshold: number): void {
    this.multiSigWallets.set('default', {
      threshold,
      signers,
      pendingTxs: new Map(),
    });

    this.logger.log('Multi-sig wallet initialized', {
      threshold,
      signerCount: signers.length,
    });
  }

  // ============================================================================
  // EVM Wallet Operations
  // ============================================================================

  getEVMWallet(provider?: ethers.Provider): ethers.Wallet {
    if (!this.defaultEvmWallet) {
      throw new Error('No EVM wallet initialized');
    }

    if (provider) {
      return this.defaultEvmWallet.connect(provider);
    }

    return this.defaultEvmWallet;
  }

  async signEVMTransaction(
    tx: ethers.TransactionRequest,
    walletId: string = 'default'
  ): Promise<string> {
    const wallet = this.evmWallets.get(walletId);
    if (!wallet) {
      throw new Error(`EVM wallet not found: ${walletId}`);
    }

    try {
      const signedTx = await wallet.signTransaction(tx);
      this.logger.debug('EVM transaction signed', {
        from: wallet.address,
        to: tx.to,
      });
      return signedTx;
    } catch (error) {
      this.logger.error('Failed to sign EVM transaction', error);
      throw error;
    }
  }

  async signEVMMessage(message: string, walletId: string = 'default'): Promise<string> {
    const wallet = this.evmWallets.get(walletId);
    if (!wallet) {
      throw new Error(`EVM wallet not found: ${walletId}`);
    }

    try {
      const signature = await wallet.signMessage(message);
      this.logger.debug('EVM message signed', { from: wallet.address });
      return signature;
    } catch (error) {
      this.logger.error('Failed to sign EVM message', error);
      throw error;
    }
  }

  getEVMAddress(walletId: string = 'default'): string {
    const wallet = this.evmWallets.get(walletId);
    if (!wallet) {
      throw new Error(`EVM wallet not found: ${walletId}`);
    }
    return wallet.address;
  }

  // ============================================================================
  // Substrate Wallet Operations
  // ============================================================================

  getSubstrateAccount(accountId: string = 'default'): KeyringPair {
    const account = this.substrateAccounts.get(accountId);
    if (!account) {
      throw new Error(`Substrate account not found: ${accountId}`);
    }
    return account;
  }

  getSubstrateAddress(accountId: string = 'default'): string {
    const account = this.getSubstrateAccount(accountId);
    return account.address;
  }

  signSubstrateMessage(message: Uint8Array, accountId: string = 'default'): Uint8Array {
    const account = this.getSubstrateAccount(accountId);
    
    try {
      const signature = account.sign(message);
      this.logger.debug('Substrate message signed', { from: account.address });
      return signature;
    } catch (error) {
      this.logger.error('Failed to sign Substrate message', error);
      throw error;
    }
  }

  // ============================================================================
  // Multi-Signature Operations
  // ============================================================================

  async proposeMultiSigTransaction(
    txData: any,
    walletId: string = 'default'
  ): Promise<string> {
    const multiSig = this.multiSigWallets.get(walletId);
    if (!multiSig) {
      throw new Error('Multi-sig wallet not configured');
    }

    const txId = this.generateTxId(txData);
    multiSig.pendingTxs.set(txId, {
      signatures: [],
      data: txData,
    });

    this.logger.log('Multi-sig transaction proposed', {
      txId,
      threshold: multiSig.threshold,
    });

    return txId;
  }

  async signMultiSigTransaction(
    txId: string,
    signature: string,
    walletId: string = 'default'
  ): Promise<{ ready: boolean; signatures: string[] }> {
    const multiSig = this.multiSigWallets.get(walletId);
    if (!multiSig) {
      throw new Error('Multi-sig wallet not configured');
    }

    const pendingTx = multiSig.pendingTxs.get(txId);
    if (!pendingTx) {
      throw new Error(`Transaction not found: ${txId}`);
    }

    pendingTx.signatures.push(signature);

    const ready = pendingTx.signatures.length >= multiSig.threshold;

    this.logger.log('Multi-sig signature added', {
      txId,
      signatureCount: pendingTx.signatures.length,
      threshold: multiSig.threshold,
      ready,
    });

    return {
      ready,
      signatures: pendingTx.signatures,
    };
  }

  getMultiSigStatus(txId: string, walletId: string = 'default'): {
    signatures: number;
    threshold: number;
    ready: boolean;
  } | null {
    const multiSig = this.multiSigWallets.get(walletId);
    if (!multiSig) {
      return null;
    }

    const pendingTx = multiSig.pendingTxs.get(txId);
    if (!pendingTx) {
      return null;
    }

    return {
      signatures: pendingTx.signatures.length,
      threshold: multiSig.threshold,
      ready: pendingTx.signatures.length >= multiSig.threshold,
    };
  }

  // ============================================================================
  // Wallet Management
  // ============================================================================

  async addEVMWallet(privateKey: string, walletId: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      this.evmWallets.set(walletId, wallet);

      this.logger.log('EVM wallet added', {
        walletId,
        address: wallet.address,
      });

      return wallet.address;
    } catch (error) {
      this.logger.error('Failed to add EVM wallet', error);
      throw error;
    }
  }

  async addSubstrateAccount(mnemonic: string, accountId: string): Promise<string> {
    try {
      if (!this.substrateKeyring) {
        this.substrateKeyring = new Keyring({ type: 'sr25519' });
      }

      const account = this.substrateKeyring.addFromUri(mnemonic);
      this.substrateAccounts.set(accountId, account);

      this.logger.log('Substrate account added', {
        accountId,
        address: account.address,
      });

      return account.address;
    } catch (error) {
      this.logger.error('Failed to add Substrate account', error);
      throw error;
    }
  }

  removeWallet(walletId: string, type: 'evm' | 'substrate'): void {
    if (type === 'evm') {
      this.evmWallets.delete(walletId);
      this.logger.log('EVM wallet removed', { walletId });
    } else {
      this.substrateAccounts.delete(walletId);
      this.logger.log('Substrate account removed', { walletId });
    }
  }

  // ============================================================================
  // Wallet Information
  // ============================================================================

  listWallets(): {
    evm: Array<{ id: string; address: string }>;
    substrate: Array<{ id: string; address: string }>;
  } {
    const evm = Array.from(this.evmWallets.entries()).map(([id, wallet]) => ({
      id,
      address: wallet.address,
    }));

    const substrate = Array.from(this.substrateAccounts.entries()).map(([id, account]) => ({
      id,
      address: account.address,
    }));

    return { evm, substrate };
  }

  hasWallet(type: 'evm' | 'substrate'): boolean {
    if (type === 'evm') {
      return this.evmWallets.size > 0;
    } else {
      return this.substrateAccounts.size > 0;
    }
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  private getWalletConfig(): WalletConfig {
    return {
      evmPrivateKey: this.configService.get<string>('AGENT_EVM_PRIVATE_KEY'),
      evmMnemonic: this.configService.get<string>('AGENT_EVM_MNEMONIC'),
      substrateMnemonic: this.configService.get<string>('AGENT_SUBSTRATE_MNEMONIC'),
      substratePrivateKey: this.configService.get<string>('AGENT_SUBSTRATE_PRIVATE_KEY'),
      multiSigEnabled: this.configService.get<boolean>('MULTI_SIG_ENABLED', false),
      multiSigThreshold: this.configService.get<number>('MULTI_SIG_THRESHOLD', 2),
      multiSigSigners: this.configService.get<string>('MULTI_SIG_SIGNERS')?.split(','),
      encryptionEnabled: this.configService.get<boolean>('WALLET_ENCRYPTION_ENABLED', true),
      kmsEnabled: this.configService.get<boolean>('KMS_ENABLED', false),
      kmsKeyId: this.configService.get<string>('KMS_KEY_ID'),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private generateTxId(txData: any): string {
    const data = JSON.stringify(txData) + Date.now();
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `multisig_${Math.abs(hash).toString(16)}_${Date.now()}`;
  }

  // ============================================================================
  // Security
  // ============================================================================

  async rotateWallets(): Promise<void> {
    this.logger.warn('Wallet rotation requested - implement secure rotation logic');
    // In production, this would:
    // 1. Generate new wallets
    // 2. Transfer funds from old to new
    // 3. Update configuration
    // 4. Securely destroy old keys
    throw new Error('Wallet rotation not implemented - requires secure key management');
  }

  async backupWallets(): Promise<void> {
    this.logger.warn('Wallet backup requested - implement secure backup logic');
    // In production, this would:
    // 1. Encrypt wallet data
    // 2. Store in secure backup location
    // 3. Log backup event
    throw new Error('Wallet backup not implemented - requires secure storage');
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async onModuleDestroy() {
    this.logger.log('Cleaning up Wallet Manager');
    
    // Clear sensitive data from memory
    this.evmWallets.clear();
    this.substrateAccounts.clear();
    this.multiSigWallets.clear();
    
    this.logger.log('Wallet Manager cleaned up');
  }
}
