/**
 * Unit tests for Call Data Encoder
 */

import { CallDataEncoderService } from '../call-data-encoder.service';
import { ethers } from 'ethers';

describe('CallDataEncoderService', () => {
  let service: CallDataEncoderService;

  beforeEach(() => {
    service = new CallDataEncoderService();
  });

  describe('Hydration Protocol Encoding', () => {
    it('should encode valid Hydration swap', async () => {
      const params = {
        tokenIn: 'DOT',
        tokenOut: 'USDT',
        amountIn: '1000000000000',
        minAmountOut: '950000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      const encoded = await service.encodeHydrationSwap(params);
      expect(encoded).toBeDefined();
      expect(encoded).toContain('router');
      expect(encoded).toContain('sell');
    });

    it('should reject Hydration swap with same tokenIn and tokenOut', async () => {
      const params = {
        tokenIn: 'DOT',
        tokenOut: 'DOT',
        amountIn: '1000000000000',
        minAmountOut: '950000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      await expect(service.encodeHydrationSwap(params)).rejects.toThrow();
    });

    it('should reject Hydration swap with zero amount', async () => {
      const params = {
        tokenIn: 'DOT',
        tokenOut: 'USDT',
        amountIn: '0',
        minAmountOut: '950000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      await expect(service.encodeHydrationSwap(params)).rejects.toThrow();
    });

    it('should reject Hydration swap with past deadline', async () => {
      const params = {
        tokenIn: 'DOT',
        tokenOut: 'USDT',
        amountIn: '1000000000000',
        minAmountOut: '950000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        deadline: Math.floor(Date.now() / 1000) - 1000
      };

      await expect(service.encodeHydrationSwap(params)).rejects.toThrow();
    });
  });

  describe('Bifrost Protocol Encoding', () => {
    it('should encode valid Bifrost mint', async () => {
      const params = {
        asset: 'DOT',
        amount: '1000000000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
      };

      const encoded = await service.encodeBifrostMint(params);
      expect(encoded).toBeDefined();
      expect(encoded).toContain('vtokenMinting');
      expect(encoded).toContain('mint');
    });

    it('should encode valid Bifrost redeem', async () => {
      const params = {
        vAsset: 'vDOT',
        amount: '1000000000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fastRedeem: false
      };

      const encoded = await service.encodeBifrostRedeem(params);
      expect(encoded).toBeDefined();
      expect(encoded).toContain('vtokenMinting');
      expect(encoded).toContain('redeem');
    });

    it('should encode Bifrost fast redeem', async () => {
      const params = {
        vAsset: 'vDOT',
        amount: '1000000000000',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        fastRedeem: true
      };

      const encoded = await service.encodeBifrostRedeem(params);
      expect(encoded).toBeDefined();
      expect(encoded).toContain('fastRedeem');
    });

    it('should reject Bifrost mint with zero amount', async () => {
      const params = {
        asset: 'DOT',
        amount: '0',
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
      };

      await expect(service.encodeBifrostMint(params)).rejects.toThrow();
    });
  });

  describe('DEX Protocol Encoding', () => {
    it('should encode valid DEX swap', async () => {
      const params = {
        tokenIn: '0x0000000000000000000000000000000000000802',
        tokenOut: '0x0000000000000000000000000000000000000803',
        amountIn: ethers.parseEther('1').toString(),
        minAmountOut: ethers.parseEther('0.95').toString(),
        path: [
          '0x0000000000000000000000000000000000000802',
          '0x0000000000000000000000000000000000000803'
        ],
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      const encoded = await service.encodeDEXSwap('stellaswap', params);
      expect(encoded).toBeDefined();
      expect(encoded).toMatch(/^0x/);
      expect(encoded.length).toBeGreaterThan(10);
    });

    it('should encode valid liquidity provision', async () => {
      const params = {
        tokenA: '0x0000000000000000000000000000000000000802',
        tokenB: '0x0000000000000000000000000000000000000803',
        amountA: ethers.parseEther('1').toString(),
        amountB: ethers.parseEther('100').toString(),
        minAmountA: ethers.parseEther('0.95').toString(),
        minAmountB: ethers.parseEther('95').toString(),
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      const encoded = await service.encodeLiquidityProvision('stellaswap', params);
      expect(encoded).toBeDefined();
      expect(encoded).toMatch(/^0x/);
      expect(encoded.length).toBeGreaterThan(10);
    });

    it('should reject DEX swap with invalid recipient address', async () => {
      const params = {
        tokenIn: '0x0000000000000000000000000000000000000802',
        tokenOut: '0x0000000000000000000000000000000000000803',
        amountIn: ethers.parseEther('1').toString(),
        minAmountOut: ethers.parseEther('0.95').toString(),
        path: [
          '0x0000000000000000000000000000000000000802',
          '0x0000000000000000000000000000000000000803'
        ],
        recipient: 'invalid-address',
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      await expect(service.encodeDEXSwap('stellaswap', params)).rejects.toThrow();
    });

    it('should reject DEX swap with empty path', async () => {
      const params = {
        tokenIn: '0x0000000000000000000000000000000000000802',
        tokenOut: '0x0000000000000000000000000000000000000803',
        amountIn: ethers.parseEther('1').toString(),
        minAmountOut: ethers.parseEther('0.95').toString(),
        path: [],
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      await expect(service.encodeDEXSwap('stellaswap', params)).rejects.toThrow();
    });
  });

  describe('Call Data Validation and Decoding', () => {
    it('should validate Substrate extrinsic call data', async () => {
      const callData = JSON.stringify({
        pallet: 'router',
        method: 'sell',
        args: { assetIn: 'DOT', assetOut: 'USDT' }
      });

      const isValid = await service.validateCallData(callData, 'router.sell');
      expect(isValid).toBe(true);
    });

    it('should validate EVM call data', async () => {
      const callData = '0x38ed1739000000000000000000000000000000000000000000000000000000000000000a';
      
      const isValid = await service.validateCallData(callData, 'swapExactTokensForTokens');
      expect(isValid).toBe(true);
    });

    it('should reject invalid call data', async () => {
      const callData = 'invalid-data';
      
      const isValid = await service.validateCallData(callData, 'any');
      expect(isValid).toBe(false);
    });

    it('should decode Substrate extrinsic', async () => {
      const callData = JSON.stringify({
        pallet: 'router',
        method: 'sell',
        args: { assetIn: 'DOT', assetOut: 'USDT', amountIn: '1000' }
      });

      const decoded = await service.decodeCallData(callData);
      expect(decoded.isValid).toBe(true);
      expect(decoded.functionName).toBe('router.sell');
      expect(decoded.parameters.assetIn).toBe('DOT');
    });

    it('should decode EVM call data', async () => {
      // First encode a swap
      const params = {
        tokenIn: '0x0000000000000000000000000000000000000802',
        tokenOut: '0x0000000000000000000000000000000000000803',
        amountIn: ethers.parseEther('1').toString(),
        minAmountOut: ethers.parseEther('0.95').toString(),
        path: [
          '0x0000000000000000000000000000000000000802',
          '0x0000000000000000000000000000000000000803'
        ],
        recipient: '0x1234567890123456789012345678901234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600
      };

      const encoded = await service.encodeDEXSwap('stellaswap', params);
      const decoded = await service.decodeCallData(encoded);
      
      expect(decoded.isValid).toBe(true);
      expect(decoded.functionName).toBe('swapExactTokensForTokens');
    });
  });
});
