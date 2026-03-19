/**
 * Call Data Encoder Service
 * Generates valid ABI-encoded function calls for all supported protocols
 */

import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  CallDataEncoder,
  DecodedCall,
  HydrationSwapParams,
  HydrationLiquidityParams,
  BifrostMintParams,
  BifrostRedeemParams,
  DEXSwapParams,
  LiquidityParams,
  ValidationResult
} from './interfaces/protocol-execution.interfaces';

@Injectable()
export class CallDataEncoderService implements CallDataEncoder {
  private readonly logger = new Logger(CallDataEncoderService.name);

  // ============================================================================
  // Hydration Protocol Encoding
  // ============================================================================

  async encodeHydrationSwap(params: HydrationSwapParams): Promise<string> {
    this.logger.debug('Encoding Hydration swap', params);
    
    // Validate parameters
    const validation = await this.validateHydrationSwapParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid Hydration swap params: ${validation.errors.join(', ')}`);
    }

    // Hydration uses Substrate extrinsics, not EVM call data
    // Format: pallet.method(args)
    // For Omnipool swap: router.sell(assetIn, assetOut, amountIn, minAmountOut)
    return this.encodeSubstrateExtrinsic('router', 'sell', {
      assetIn: params.tokenIn,
      assetOut: params.tokenOut,
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
      route: [] // Direct swap through omnipool
    });
  }

  async encodeHydrationLiquidity(params: HydrationLiquidityParams): Promise<string> {
    this.logger.debug('Encoding Hydration liquidity provision', params);
    
    // Validate parameters
    const validation = await this.validateHydrationLiquidityParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid Hydration liquidity params: ${validation.errors.join(', ')}`);
    }

    // Hydration Omnipool liquidity provision
    return this.encodeSubstrateExtrinsic('omnipool', 'addLiquidity', {
      asset: params.tokenA,
      amount: params.amountA
    });
  }

  // ============================================================================
  // Bifrost Protocol Encoding
  // ============================================================================

  async encodeBifrostMint(params: BifrostMintParams): Promise<string> {
    this.logger.debug('Encoding Bifrost mint', params);
    
    // Validate parameters
    const validation = await this.validateBifrostMintParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid Bifrost mint params: ${validation.errors.join(', ')}`);
    }

    // Bifrost liquid staking mint
    return this.encodeSubstrateExtrinsic('vtokenMinting', 'mint', {
      tokenId: params.asset,
      tokenAmount: params.amount
    });
  }

  async encodeBifrostRedeem(params: BifrostRedeemParams): Promise<string> {
    this.logger.debug('Encoding Bifrost redeem', params);
    
    // Validate parameters
    const validation = await this.validateBifrostRedeemParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid Bifrost redeem params: ${validation.errors.join(', ')}`);
    }

    // Bifrost liquid staking redeem
    return this.encodeSubstrateExtrinsic(
      'vtokenMinting',
      params.fastRedeem ? 'fastRedeem' : 'redeem',
      {
        vtokenId: params.vAsset,
        vtokenAmount: params.amount
      }
    );
  }

  // ============================================================================
  // Moonbeam DEX Encoding (EVM-based)
  // ============================================================================

  async encodeDEXSwap(protocol: string, params: DEXSwapParams): Promise<string> {
    this.logger.debug(`Encoding ${protocol} DEX swap`, params);
    
    // Validate parameters
    const validation = await this.validateDEXSwapParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid DEX swap params: ${validation.errors.join(', ')}`);
    }

    // UniswapV2-style router interface
    const abi = [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];

    return this.encodeEVMFunction(abi, 'swapExactTokensForTokens', [
      params.amountIn,
      params.minAmountOut,
      params.path,
      params.recipient,
      params.deadline
    ]);
  }

  async encodeLiquidityProvision(protocol: string, params: LiquidityParams): Promise<string> {
    this.logger.debug(`Encoding ${protocol} liquidity provision`, params);
    
    // Validate parameters
    const validation = await this.validateLiquidityParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid liquidity params: ${validation.errors.join(', ')}`);
    }

    // UniswapV2-style router interface
    const abi = [
      'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)'
    ];

    return this.encodeEVMFunction(abi, 'addLiquidity', [
      params.tokenA,
      params.tokenB,
      params.amountA,
      params.amountB,
      params.minAmountA,
      params.minAmountB,
      params.recipient,
      params.deadline
    ]);
  }

  // ============================================================================
  // Validation and Decoding
  // ============================================================================

  async validateCallData(callData: string, expectedFunction: string): Promise<boolean> {
    try {
      // For Substrate extrinsics (JSON format)
      if (callData.startsWith('{')) {
        const extrinsic = JSON.parse(callData);
        return !!(extrinsic.pallet && extrinsic.method && extrinsic.args);
      }

      // For EVM call data (hex format)
      if (callData.startsWith('0x')) {
        // Check if it's valid hex and has at least function selector (4 bytes)
        return ethers.isHexString(callData) && callData.length >= 10;
      }

      return false;
    } catch (error) {
      this.logger.error('Call data validation failed', error);
      return false;
    }
  }

  async decodeCallData(callData: string): Promise<DecodedCall> {
    try {
      // For Substrate extrinsics (JSON format)
      if (callData.startsWith('{')) {
        const extrinsic = this.decodeSubstrateExtrinsic(callData);
        if (extrinsic) {
          return {
            functionName: `${extrinsic.pallet}.${extrinsic.method}`,
            parameters: extrinsic.args,
            isValid: true
          };
        }
        return {
          functionName: 'unknown',
          parameters: {},
          isValid: false
        };
      }

      // For EVM call data (hex format)
      if (callData.startsWith('0x')) {
        // Extract function selector (first 4 bytes)
        const selector = callData.slice(0, 10);
        
        // Try to decode with known interfaces
        const decoded = await this.tryDecodeEVMCallData(callData);
        
        return {
          functionName: decoded.functionName || selector,
          parameters: decoded.parameters || {},
          isValid: decoded.isValid
        };
      }

      return {
        functionName: 'unknown',
        parameters: {},
        isValid: false
      };
    } catch (error) {
      this.logger.error('Call data decoding failed', error);
      return {
        functionName: 'error',
        parameters: { error: error instanceof Error ? error.message : String(error) },
        isValid: false
      };
    }
  }

  // ============================================================================
  // Private Helper Methods - ABI Encoding/Decoding Utilities
  // ============================================================================

  /**
   * Encode EVM function call using ethers.js Interface
   * Provides type-safe ABI encoding with automatic parameter validation
   */
  private encodeEVMFunction(
    abi: string[],
    functionName: string,
    params: any[]
  ): string {
    try {
      const iface = new ethers.Interface(abi);
      return iface.encodeFunctionData(functionName, params);
    } catch (error) {
      this.logger.error(`Failed to encode ${functionName}`, error);
      throw new Error(`ABI encoding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Decode EVM function call data
   * Returns function name and decoded parameters
   */
  private decodeEVMFunction(
    abi: string[],
    callData: string
  ): { name: string; args: any[] } | null {
    try {
      const iface = new ethers.Interface(abi);
      const decoded = iface.parseTransaction({ data: callData });
      return decoded ? { name: decoded.name, args: Array.from(decoded.args) } : null;
    } catch (error) {
      this.logger.debug(`Failed to decode with provided ABI`, error);
      return null;
    }
  }

  /**
   * Validate Ethereum address format
   */
  private isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Validate amount is positive and non-zero
   */
  private isValidAmount(amount: string): boolean {
    try {
      const value = BigInt(amount);
      return value > 0n;
    } catch {
      return false;
    }
  }

  /**
   * Validate deadline is in the future
   */
  private isValidDeadline(deadline: number): boolean {
    return deadline > Math.floor(Date.now() / 1000);
  }

  /**
   * Encode Substrate extrinsic as JSON
   * Substrate chains use different encoding than EVM
   */
  private encodeSubstrateExtrinsic(
    pallet: string,
    method: string,
    args: Record<string, any>
  ): string {
    const extrinsic = {
      pallet,
      method,
      args
    };
    return JSON.stringify(extrinsic);
  }

  /**
   * Decode Substrate extrinsic from JSON
   */
  private decodeSubstrateExtrinsic(callData: string): {
    pallet: string;
    method: string;
    args: Record<string, any>;
  } | null {
    try {
      const extrinsic = JSON.parse(callData);
      if (extrinsic.pallet && extrinsic.method && extrinsic.args) {
        return extrinsic;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async tryDecodeEVMCallData(callData: string): Promise<DecodedCall> {
    // Try decoding with known interfaces
    const interfaces = [
      // UniswapV2 Router
      new ethers.Interface([
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
        'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline)'
      ])
    ];

    for (const iface of interfaces) {
      try {
        const decoded = iface.parseTransaction({ data: callData });
        if (decoded) {
          return {
            functionName: decoded.name,
            parameters: this.formatDecodedParams(decoded.args),
            isValid: true
          };
        }
      } catch {
        // Try next interface
        continue;
      }
    }

    return {
      functionName: 'unknown',
      parameters: {},
      isValid: false
    };
  }

  private formatDecodedParams(args: any): Record<string, any> {
    const params: Record<string, any> = {};
    
    for (let i = 0; i < args.length; i++) {
      const value = args[i];
      params[`arg${i}`] = typeof value === 'bigint' ? value.toString() : value;
    }
    
    return params;
  }

  // ============================================================================
  // Parameter Validation Methods
  // ============================================================================

  private async validateHydrationSwapParams(params: HydrationSwapParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.tokenIn) errors.push('tokenIn is required');
    if (!params.tokenOut) errors.push('tokenOut is required');
    if (params.tokenIn === params.tokenOut) errors.push('tokenIn and tokenOut must be different');
    if (!params.amountIn || !this.isValidAmount(params.amountIn)) {
      errors.push('amountIn must be a positive number');
    }
    if (!params.minAmountOut || !this.isValidAmount(params.minAmountOut)) {
      errors.push('minAmountOut must be a positive number');
    }
    if (!params.recipient) errors.push('recipient is required');
    if (!params.deadline || !this.isValidDeadline(params.deadline)) {
      errors.push('deadline must be in the future');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async validateHydrationLiquidityParams(params: HydrationLiquidityParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.tokenA) errors.push('tokenA is required');
    if (!params.tokenB) errors.push('tokenB is required');
    if (params.tokenA === params.tokenB) errors.push('tokenA and tokenB must be different');
    if (!params.amountA || !this.isValidAmount(params.amountA)) {
      errors.push('amountA must be a positive number');
    }
    if (!params.amountB || !this.isValidAmount(params.amountB)) {
      errors.push('amountB must be a positive number');
    }
    if (!params.recipient) errors.push('recipient is required');
    if (!params.deadline || !this.isValidDeadline(params.deadline)) {
      errors.push('deadline must be in the future');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async validateBifrostMintParams(params: BifrostMintParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.asset) errors.push('asset is required');
    if (!params.amount || !this.isValidAmount(params.amount)) {
      errors.push('amount must be a positive number');
    }
    if (!params.recipient) errors.push('recipient is required');

    return { valid: errors.length === 0, errors, warnings };
  }

  private async validateBifrostRedeemParams(params: BifrostRedeemParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.vAsset) errors.push('vAsset is required');
    if (!params.amount || !this.isValidAmount(params.amount)) {
      errors.push('amount must be a positive number');
    }
    if (!params.recipient) errors.push('recipient is required');

    return { valid: errors.length === 0, errors, warnings };
  }

  private async validateDEXSwapParams(params: DEXSwapParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.tokenIn) errors.push('tokenIn is required');
    if (!params.tokenOut) errors.push('tokenOut is required');
    if (params.tokenIn === params.tokenOut) errors.push('tokenIn and tokenOut must be different');
    if (!params.amountIn || !this.isValidAmount(params.amountIn)) {
      errors.push('amountIn must be a positive number');
    }
    if (!params.minAmountOut || !this.isValidAmount(params.minAmountOut)) {
      errors.push('minAmountOut must be a positive number');
    }
    if (!params.path || params.path.length < 2) errors.push('path must have at least 2 tokens');
    if (!params.recipient || !this.isValidAddress(params.recipient)) {
      errors.push('recipient must be a valid Ethereum address');
    }
    if (!params.deadline || !this.isValidDeadline(params.deadline)) {
      errors.push('deadline must be in the future');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async validateLiquidityParams(params: LiquidityParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.tokenA || !this.isValidAddress(params.tokenA)) {
      errors.push('tokenA must be a valid Ethereum address');
    }
    if (!params.tokenB || !this.isValidAddress(params.tokenB)) {
      errors.push('tokenB must be a valid Ethereum address');
    }
    if (params.tokenA === params.tokenB) errors.push('tokenA and tokenB must be different');
    if (!params.amountA || !this.isValidAmount(params.amountA)) {
      errors.push('amountA must be a positive number');
    }
    if (!params.amountB || !this.isValidAmount(params.amountB)) {
      errors.push('amountB must be a positive number');
    }
    if (!params.minAmountA || !this.isValidAmount(params.minAmountA)) {
      errors.push('minAmountA must be a positive number');
    }
    if (!params.minAmountB || !this.isValidAmount(params.minAmountB)) {
      errors.push('minAmountB must be a positive number');
    }
    if (!params.recipient || !this.isValidAddress(params.recipient)) {
      errors.push('recipient must be a valid Ethereum address');
    }
    if (!params.deadline || !this.isValidDeadline(params.deadline)) {
      errors.push('deadline must be in the future');
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
