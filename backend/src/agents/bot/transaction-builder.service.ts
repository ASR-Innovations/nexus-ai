import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { WalletManagerService } from './wallet-manager.service';
import {
  TransactionBuilder,
  TransactionParams,
  UnsignedTransaction,
  SignedTransaction,
  TransactionResult,
  BatchTransaction,
} from './interfaces/protocol-execution.interfaces';

@Injectable()
export class TransactionBuilderService implements TransactionBuilder {
  private readonly logger = new Logger(TransactionBuilderService.name);
  
  // Nonce management: track pending nonces per address
  private nonceTracker: Map<string, number> = new Map();
  
  // Provider cache per chain
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  
  // Gas price cache with TTL
  private gasPriceCache: Map<number, { price: bigint; timestamp: number }> = new Map();
  private readonly GAS_PRICE_CACHE_TTL = 15000; // 15 seconds
  
  // Network gas price multipliers for different urgency levels
  private readonly GAS_MULTIPLIERS = {
    low: 0.9,    // 10% below current
    medium: 1.0, // Current price
    high: 1.3,   // 30% above current
  };
  
  // Gas optimization history for learning
  private gasOptimizationHistory: Array<{
    timestamp: number;
    chainId: number;
    urgency: 'low' | 'medium' | 'high';
    gasPrice: bigint;
    actualConfirmationTime?: number;
  }> = [];
  
  // Maximum history entries to keep
  private readonly MAX_HISTORY_ENTRIES = 100;

  constructor(private readonly walletManager: WalletManagerService) {}

  // ============================================================================
  // Transaction Construction
  // ============================================================================

  async buildTransaction(params: TransactionParams): Promise<UnsignedTransaction> {
    this.logger.debug('Building transaction', { to: params.to, chainId: params.chainId });

    try {
      // Get provider for the chain
      const provider = this.getProvider(params.chainId);

      // Get nonce for the sender
      const nonce = params.nonce ?? await this.getNextNonce(params.to, provider);

      // Estimate gas if not provided
      let gasLimit: bigint;
      if (params.gasLimit) {
        gasLimit = BigInt(params.gasLimit);
      } else {
        gasLimit = await this.estimateGasForTransaction(params, provider);
      }

      // Get gas price if not provided
      let gasPrice: bigint;
      if (params.gasPrice) {
        gasPrice = BigInt(params.gasPrice);
      } else {
        gasPrice = await this.optimizeGasPrice('medium');
      }

      // Parse value
      const value = BigInt(params.value || '0');

      // Construct unsigned transaction
      const unsignedTx: UnsignedTransaction = {
        to: params.to,
        data: params.data,
        value,
        gasLimit,
        gasPrice,
        nonce,
        chainId: params.chainId,
      };

      this.logger.debug('Transaction built successfully', {
        nonce,
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.toString(),
      });

      return unsignedTx;
    } catch (error) {
      this.logger.error('Failed to build transaction', error);
      throw new Error(`Transaction construction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async signTransaction(
    tx: UnsignedTransaction,
    wallet: ethers.Wallet | ethers.HDNodeWallet
  ): Promise<SignedTransaction> {
    this.logger.debug('Signing transaction', { to: tx.to, nonce: tx.nonce });

    try {
      // Create transaction object for ethers
      const txRequest: ethers.TransactionRequest = {
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
        chainId: tx.chainId,
      };

      // Sign the transaction
      const signedTxHex = await wallet.signTransaction(txRequest);
      
      // Parse the signed transaction to extract signature components
      const parsedTx = ethers.Transaction.from(signedTxHex);
      
      if (!parsedTx.signature) {
        throw new Error('Transaction signature is missing');
      }

      // Construct signed transaction object
      const signedTx: SignedTransaction = {
        ...tx,
        signature: {
          r: parsedTx.signature.r,
          s: parsedTx.signature.s,
          v: parsedTx.signature.v,
        },
        hash: parsedTx.hash || '',
      };

      this.logger.debug('Transaction signed successfully', { hash: signedTx.hash });

      return signedTx;
    } catch (error) {
      this.logger.error('Failed to sign transaction', error);
      throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sign transaction using WalletManager (integrated wallet service)
   */
  async signTransactionWithWalletManager(
    tx: UnsignedTransaction,
    walletId: string = 'default'
  ): Promise<SignedTransaction> {
    this.logger.debug('Signing transaction with WalletManager', { to: tx.to, nonce: tx.nonce, walletId });

    try {
      // Get wallet from WalletManager
      const provider = this.getProvider(tx.chainId);
      const wallet = this.walletManager.getEVMWallet(provider);

      // Use the existing signTransaction method
      return await this.signTransaction(tx, wallet);
    } catch (error) {
      this.logger.error('Failed to sign transaction with WalletManager', error);
      throw new Error(`Transaction signing with WalletManager failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // Gas Optimization
  // ============================================================================

  async estimateGas(tx: UnsignedTransaction): Promise<bigint> {
    this.logger.debug('Estimating gas for transaction', { to: tx.to });

    try {
      const provider = this.getProvider(tx.chainId);

      // Create transaction request for estimation
      const txRequest: ethers.TransactionRequest = {
        to: tx.to,
        data: tx.data,
        value: tx.value,
        from: ethers.ZeroAddress, // Use zero address for estimation
      };

      // Estimate gas using real RPC call
      const gasEstimate = await provider.estimateGas(txRequest);

      // Add 20% buffer for safety (real transactions may use slightly more)
      const gasWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100);

      this.logger.debug('Gas estimated from network', {
        estimate: gasEstimate.toString(),
        withBuffer: gasWithBuffer.toString(),
      });

      return gasWithBuffer;
    } catch (error) {
      this.logger.error('Gas estimation failed', error);
      
      // Try to parse error for out-of-gas or revert reasons
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('execution reverted')) {
        this.logger.error('Transaction would revert', { error: errorMessage });
        throw new Error(`Transaction would revert: ${errorMessage}`);
      }
      
      // Return a reasonable default based on transaction type
      let defaultGas = BigInt(21000); // Basic transfer
      
      if (tx.data && tx.data !== '0x' && tx.data.length > 10) {
        // Contract interaction - use higher default
        defaultGas = BigInt(300000);
      }
      
      this.logger.warn(`Using default gas limit: ${defaultGas}`);
      return defaultGas;
    }
  }

  async optimizeGasPrice(urgency: 'low' | 'medium' | 'high'): Promise<bigint> {
    this.logger.debug('Optimizing gas price', { urgency });

    try {
      // Use Polkadot Hub Testnet as default chain ID
      const chainId = 420420417;
      
      // Check cache first
      const cached = this.gasPriceCache.get(chainId);
      const now = Date.now();
      
      let baseGasPrice: bigint;
      
      if (cached && (now - cached.timestamp) < this.GAS_PRICE_CACHE_TTL) {
        baseGasPrice = cached.price;
        this.logger.debug('Using cached gas price', { price: baseGasPrice.toString() });
      } else {
        // Fetch current gas price from network - REAL QUERY
        const provider = this.getProvider(chainId);
        const feeData = await provider.getFeeData();
        
        // Use actual network gas price
        if (feeData.gasPrice) {
          baseGasPrice = feeData.gasPrice;
        } else if (feeData.maxFeePerGas) {
          // EIP-1559 transaction
          baseGasPrice = feeData.maxFeePerGas;
        } else {
          // Fallback to querying gas price directly
          baseGasPrice = (await provider.send('eth_gasPrice', [])) as bigint;
        }
        
        // Update cache with real data
        this.gasPriceCache.set(chainId, { price: baseGasPrice, timestamp: now });
        this.logger.debug('Fetched real gas price from network', { 
          price: baseGasPrice.toString(),
          priceGwei: ethers.formatUnits(baseGasPrice, 'gwei')
        });
      }

      // Apply dynamic optimization based on network conditions and historical data
      const optimizedPrice = await this.calculateOptimalGasPrice(
        baseGasPrice,
        urgency,
        chainId
      );

      // Record optimization for learning
      this.recordGasOptimization(chainId, urgency, optimizedPrice);

      this.logger.debug('Gas price optimized', {
        base: baseGasPrice.toString(),
        baseGwei: ethers.formatUnits(baseGasPrice, 'gwei'),
        urgency,
        optimized: optimizedPrice.toString(),
        optimizedGwei: ethers.formatUnits(optimizedPrice, 'gwei'),
      });

      return optimizedPrice;
    } catch (error) {
      this.logger.error('Gas price optimization failed', error);
      
      // Query fallback gas price from network
      try {
        const provider = this.getProvider(420420417); // Polkadot Hub Testnet
        const gasPrice = await provider.send('eth_gasPrice', []);
        this.logger.warn(`Using fallback gas price from network: ${gasPrice}`);
        return BigInt(gasPrice);
      } catch (fallbackError) {
        // Last resort - use a reasonable default
        const defaultGasPrice = BigInt(1000000000); // 1 gwei
        this.logger.warn(`Using default gas price: ${defaultGasPrice}`);
        return defaultGasPrice;
      }
    }
  }

  /**
   * Calculate optimal gas price based on network conditions and historical data
   * Implements dynamic gas price calculation (Requirement 4.3)
   */
  private async calculateOptimalGasPrice(
    baseGasPrice: bigint,
    urgency: 'low' | 'medium' | 'high',
    chainId: number
  ): Promise<bigint> {
    // Start with base multiplier
    let multiplier = this.GAS_MULTIPLIERS[urgency];

    // Analyze recent history for this chain
    const recentHistory = this.gasOptimizationHistory
      .filter(entry => entry.chainId === chainId)
      .slice(-10); // Last 10 transactions

    if (recentHistory.length > 0) {
      // Calculate average confirmation time for each urgency level
      const urgencyStats = recentHistory
        .filter(entry => entry.urgency === urgency && entry.actualConfirmationTime)
        .map(entry => entry.actualConfirmationTime!);

      if (urgencyStats.length > 0) {
        const avgConfirmationTime = urgencyStats.reduce((a, b) => a + b, 0) / urgencyStats.length;
        
        // Adjust multiplier based on confirmation times
        // If confirmations are slow, increase multiplier
        if (urgency === 'high' && avgConfirmationTime > 30000) { // > 30 seconds
          multiplier = Math.min(multiplier * 1.2, 1.5); // Cap at 1.5x
        } else if (urgency === 'medium' && avgConfirmationTime > 60000) { // > 1 minute
          multiplier = Math.min(multiplier * 1.1, 1.3);
        }
      }
    }

    // Apply the calculated multiplier
    const optimizedPrice = (baseGasPrice * BigInt(Math.floor(multiplier * 100))) / BigInt(100);

    return optimizedPrice;
  }

  /**
   * Record gas optimization for historical analysis
   */
  private recordGasOptimization(
    chainId: number,
    urgency: 'low' | 'medium' | 'high',
    gasPrice: bigint
  ): void {
    this.gasOptimizationHistory.push({
      timestamp: Date.now(),
      chainId,
      urgency,
      gasPrice,
    });

    // Trim history if it exceeds max entries
    if (this.gasOptimizationHistory.length > this.MAX_HISTORY_ENTRIES) {
      this.gasOptimizationHistory = this.gasOptimizationHistory.slice(-this.MAX_HISTORY_ENTRIES);
    }
  }

  /**
   * Update confirmation time for a transaction (for learning)
   */
  updateConfirmationTime(txHash: string, confirmationTime: number): void {
    // In a production system, we'd track tx hash to history entry
    // For now, update the most recent entry
    if (this.gasOptimizationHistory.length > 0) {
      const lastEntry = this.gasOptimizationHistory[this.gasOptimizationHistory.length - 1];
      lastEntry.actualConfirmationTime = confirmationTime;
    }
  }

  /**
   * Optimize batch transaction gas prices
   * Implements batch transaction optimization (Requirement 8.7)
   */
  async optimizeBatchGasPrices(
    txs: UnsignedTransaction[],
    urgency: 'low' | 'medium' | 'high'
  ): Promise<UnsignedTransaction[]> {
    this.logger.debug('Optimizing batch gas prices', { count: txs.length, urgency });

    try {
      if (txs.length === 0) {
        return txs;
      }

      // Get optimal gas price for the batch
      const optimalGasPrice = await this.optimizeGasPrice(urgency);

      // Apply the same gas price to all transactions in the batch
      // This ensures consistent execution and simplifies tracking
      const optimizedTxs = txs.map(tx => ({
        ...tx,
        gasPrice: optimalGasPrice,
      }));

      // Calculate total cost savings
      const originalCost = txs.reduce((sum, tx) => sum + (tx.gasLimit * tx.gasPrice), BigInt(0));
      const optimizedCost = optimizedTxs.reduce((sum, tx) => sum + (tx.gasLimit * tx.gasPrice), BigInt(0));
      const savings = originalCost - optimizedCost;

      this.logger.debug('Batch gas optimization complete', {
        originalCost: ethers.formatEther(originalCost),
        optimizedCost: ethers.formatEther(optimizedCost),
        savings: ethers.formatEther(savings),
      });

      return optimizedTxs;
    } catch (error) {
      this.logger.error('Batch gas optimization failed', error);
      return txs; // Return original transactions if optimization fails
    }
  }

  /**
   * Estimate total execution cost for multiple operations
   * Minimizes total execution costs across all operations (Requirement 8.7)
   */
  async estimateTotalExecutionCost(txs: UnsignedTransaction[]): Promise<{
    totalGasCost: bigint;
    totalGasLimit: bigint;
    averageGasPrice: bigint;
    estimatedCostETH: string;
    breakdown: Array<{ index: number; gasLimit: bigint; gasPrice: bigint; cost: bigint }>;
  }> {
    this.logger.debug('Estimating total execution cost', { count: txs.length });

    const breakdown = txs.map((tx, index) => {
      const cost = tx.gasLimit * tx.gasPrice;
      return {
        index,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        cost,
      };
    });

    const totalGasCost = breakdown.reduce((sum, item) => sum + item.cost, BigInt(0));
    const totalGasLimit = breakdown.reduce((sum, item) => sum + item.gasLimit, BigInt(0));
    const averageGasPrice = txs.length > 0
      ? breakdown.reduce((sum, item) => sum + item.gasPrice, BigInt(0)) / BigInt(txs.length)
      : BigInt(0);

    return {
      totalGasCost,
      totalGasLimit,
      averageGasPrice,
      estimatedCostETH: ethers.formatEther(totalGasCost),
      breakdown,
    };
  }

  // ============================================================================
  // Transaction Execution
  // ============================================================================

  async submitTransaction(tx: SignedTransaction): Promise<TransactionResult> {
    this.logger.log('Submitting transaction', { hash: tx.hash, to: tx.to });

    try {
      const provider = this.getProvider(tx.chainId);

      // Serialize the signed transaction
      const serializedTx = this.serializeSignedTransaction(tx);

      // Broadcast transaction
      const response = await provider.broadcastTransaction(serializedTx);

      this.logger.log('Transaction submitted successfully', {
        hash: response.hash,
        nonce: tx.nonce,
      });

      return {
        success: true,
        transactionHash: response.hash,
      };
    } catch (error) {
      this.logger.error('Transaction submission failed', error);
      
      return {
        success: false,
        transactionHash: tx.hash,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async waitForConfirmation(
    txHash: string,
    confirmations: number
  ): Promise<ethers.TransactionReceipt> {
    this.logger.debug('Waiting for transaction confirmation', { txHash, confirmations });

    try {
      // Use Polkadot Hub Testnet as default chain
      const chainId = 420420417;
      const provider = this.getProvider(chainId);

      // Wait for transaction receipt
      const receipt = await provider.waitForTransaction(txHash, confirmations);

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      this.logger.log('Transaction confirmed', {
        hash: txHash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
      });

      return receipt;
    } catch (error) {
      this.logger.error('Failed to wait for confirmation', error);
      throw new Error(`Confirmation wait failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  async buildBatchTransaction(txs: UnsignedTransaction[]): Promise<BatchTransaction> {
    this.logger.debug('Building batch transaction', { count: txs.length });

    try {
      if (txs.length === 0) {
        throw new Error('Cannot build batch transaction with no transactions');
      }

      // Validate all transactions are for the same chain
      const chainId = txs[0].chainId;
      const allSameChain = txs.every(tx => tx.chainId === chainId);
      
      if (!allSameChain) {
        throw new Error('All transactions in batch must be for the same chain');
      }

      // Calculate total gas limit
      const totalGasLimit = txs.reduce((sum, tx) => sum + tx.gasLimit, BigInt(0));

      // Estimate total cost
      const avgGasPrice = txs.reduce((sum, tx) => sum + tx.gasPrice, BigInt(0)) / BigInt(txs.length);
      const estimatedCost = totalGasLimit * avgGasPrice;

      const batch: BatchTransaction = {
        transactions: txs,
        totalGasLimit,
        estimatedCost: ethers.formatEther(estimatedCost),
      };

      this.logger.debug('Batch transaction built', {
        count: txs.length,
        totalGas: totalGasLimit.toString(),
        estimatedCost: batch.estimatedCost,
      });

      return batch;
    } catch (error) {
      this.logger.error('Failed to build batch transaction', error);
      throw new Error(`Batch construction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // Nonce Management
  // ============================================================================

  private async getNextNonce(
    address: string,
    provider: ethers.JsonRpcProvider
  ): Promise<number> {
    try {
      // Check if we have a pending nonce tracked
      const trackedNonce = this.nonceTracker.get(address.toLowerCase());
      
      // Get on-chain nonce
      const onChainNonce = await provider.getTransactionCount(address, 'pending');

      // Use the higher of tracked or on-chain nonce
      const nextNonce = trackedNonce !== undefined 
        ? Math.max(trackedNonce, onChainNonce)
        : onChainNonce;

      // Update tracker
      this.nonceTracker.set(address.toLowerCase(), nextNonce + 1);

      this.logger.debug('Nonce determined', {
        address,
        onChain: onChainNonce,
        tracked: trackedNonce,
        next: nextNonce,
      });

      return nextNonce;
    } catch (error) {
      this.logger.error('Failed to get nonce', error);
      throw new Error(`Nonce retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reset nonce tracker for an address
   * Useful when transactions fail or need to be resubmitted
   */
  resetNonce(address: string): void {
    this.nonceTracker.delete(address.toLowerCase());
    this.logger.debug('Nonce tracker reset', { address });
  }

  /**
   * Manually set nonce for an address
   * Use with caution - mainly for recovery scenarios
   */
  setNonce(address: string, nonce: number): void {
    this.nonceTracker.set(address.toLowerCase(), nonce);
    this.logger.debug('Nonce manually set', { address, nonce });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getProvider(chainId: number): ethers.JsonRpcProvider {
    // Check cache first
    let provider = this.providers.get(chainId);
    
    if (!provider) {
      // Create new provider based on chain ID
      const rpcUrl = this.getRpcUrl(chainId);
      provider = new ethers.JsonRpcProvider(rpcUrl);
      this.providers.set(chainId, provider);
      
      this.logger.debug('Created new provider', { chainId, rpcUrl });
    }
    
    return provider;
  }

  private getRpcUrl(chainId: number): string {
    // Map chain IDs to RPC URLs
    const rpcUrls: Record<number, string> = {
      420420417: 'https://eth-rpc-testnet.polkadot.io/', // Polkadot Hub Testnet (Paseo) - PRIMARY
      1287: 'https://rpc.api.moonbase.moonbeam.network', // Moonbase Alpha
      1: 'https://eth.llamarpc.com', // Ethereum Mainnet
      5: 'https://goerli.infura.io/v3/YOUR_INFURA_KEY', // Goerli (deprecated)
      11155111: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY', // Sepolia
    };

    const url = rpcUrls[chainId];
    
    if (!url) {
      throw new Error(`No RPC URL configured for chain ID ${chainId}`);
    }
    
    return url;
  }

  private async estimateGasForTransaction(
    params: TransactionParams,
    provider: ethers.JsonRpcProvider
  ): Promise<bigint> {
    try {
      const txRequest: ethers.TransactionRequest = {
        to: params.to,
        data: params.data,
        value: BigInt(params.value || '0'),
        from: ethers.ZeroAddress,
      };

      const estimate = await provider.estimateGas(txRequest);
      
      // Add 20% buffer
      return (estimate * BigInt(120)) / BigInt(100);
    } catch (error) {
      this.logger.warn('Gas estimation failed, using default', error);
      return BigInt(300000);
    }
  }

  private serializeSignedTransaction(tx: SignedTransaction): string {
    try {
      // Create ethers Transaction object
      const ethersTx = ethers.Transaction.from({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
        chainId: tx.chainId,
        signature: {
          r: tx.signature.r,
          s: tx.signature.s,
          v: tx.signature.v,
        },
      });

      // Serialize to hex string
      return ethersTx.serialized;
    } catch (error) {
      this.logger.error('Failed to serialize transaction', error);
      throw new Error(`Transaction serialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear gas price cache
   * Useful for testing or when network conditions change rapidly
   */
  clearGasPriceCache(): void {
    this.gasPriceCache.clear();
    this.logger.debug('Gas price cache cleared');
  }

  /**
   * Get current nonce tracker state (for debugging)
   */
  getNonceTrackerState(): Map<string, number> {
    return new Map(this.nonceTracker);
  }
}
