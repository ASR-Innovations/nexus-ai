/**
 * Property-based tests for Call Data Encoder
 * Feature: real-protocol-execution
 */

import fc from 'fast-check';
import { CallDataEncoderService } from '../call-data-encoder.service';
import {
  hydrationSwapParamsArbitrary,
  bifrostMintParamsArbitrary,
  dexSwapParamsArbitrary,
  liquidityParamsArbitrary,
  defaultPropertyTestConfig
} from '../testing/property-test-utils';

describe('CallDataEncoder Property Tests', () => {
  let encoder: CallDataEncoderService;

  beforeEach(() => {
    encoder = new CallDataEncoderService();
  });

  // Feature: real-protocol-execution, Property 1: Protocol Call Data Round-Trip Integrity
  describe('Property 1: Protocol Call Data Round-Trip Integrity', () => {
    test('Hydration swap encoding then decoding produces equivalent parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          hydrationSwapParamsArbitrary(),
          async (params) => {
            // Encode the parameters
            const encoded = await encoder.encodeHydrationSwap(params);
            
            // Decode the call data
            const decoded = await encoder.decodeCallData(encoded);
            
            // Verify round-trip integrity
            expect(decoded.isValid).toBe(true);
            expect(decoded.functionName).toBe('router.sell');
            expect(decoded.parameters.assetIn).toBe(params.tokenIn);
            expect(decoded.parameters.assetOut).toBe(params.tokenOut);
            expect(decoded.parameters.amountIn).toBe(params.amountIn);
            expect(decoded.parameters.minAmountOut).toBe(params.minAmountOut);
          }
        ),
        defaultPropertyTestConfig
      );
    }, 30000);

    test('Bifrost mint encoding then decoding produces equivalent parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          bifrostMintParamsArbitrary(),
          async (params) => {
            // Encode the parameters
            const encoded = await encoder.encodeBifrostMint(params);
            
            // Decode the call data
            const decoded = await encoder.decodeCallData(encoded);
            
            // Verify round-trip integrity
            expect(decoded.isValid).toBe(true);
            expect(decoded.functionName).toBe('vtokenMinting.mint');
            expect(decoded.parameters.tokenId).toBe(params.asset);
            expect(decoded.parameters.tokenAmount).toBe(params.amount);
          }
        ),
        defaultPropertyTestConfig
      );
    }, 30000);

    test('DEX swap encoding then decoding produces equivalent parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          dexSwapParamsArbitrary(),
          async (params) => {
            // Encode the parameters
            const encoded = await encoder.encodeDEXSwap('stellaswap', params);
            
            // Decode the call data
            const decoded = await encoder.decodeCallData(encoded);
            
            // Verify round-trip integrity
            expect(decoded.isValid).toBe(true);
            expect(decoded.functionName).toBe('swapExactTokensForTokens');
            
            // Verify parameters (EVM decoding uses arg0, arg1, etc.)
            expect(decoded.parameters.arg0).toBe(params.amountIn);
            expect(decoded.parameters.arg1).toBe(params.minAmountOut);
            expect(decoded.parameters.arg2).toEqual(params.path);
            expect(decoded.parameters.arg3).toBe(params.recipient);
            expect(decoded.parameters.arg4).toBe(params.deadline.toString());
          }
        ),
        defaultPropertyTestConfig
      );
    }, 30000);

    test('Liquidity provision encoding then decoding produces equivalent parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          liquidityParamsArbitrary(),
          async (params) => {
            // Encode the parameters
            const encoded = await encoder.encodeLiquidityProvision('stellaswap', params);
            
            // Decode the call data
            const decoded = await encoder.decodeCallData(encoded);
            
            // Verify round-trip integrity
            expect(decoded.isValid).toBe(true);
            expect(decoded.functionName).toBe('addLiquidity');
            
            // Verify parameters
            expect(decoded.parameters.arg0).toBe(params.tokenA);
            expect(decoded.parameters.arg1).toBe(params.tokenB);
            expect(decoded.parameters.arg2).toBe(params.amountA);
            expect(decoded.parameters.arg3).toBe(params.amountB);
            expect(decoded.parameters.arg4).toBe(params.minAmountA);
            expect(decoded.parameters.arg5).toBe(params.minAmountB);
            expect(decoded.parameters.arg6).toBe(params.recipient);
            expect(decoded.parameters.arg7).toBe(params.deadline.toString());
          }
        ),
        defaultPropertyTestConfig
      );
    }, 30000);
  });

  // Feature: real-protocol-execution, Property 3: Parameter Validation Before Encoding
  describe('Property 3: Parameter Validation Before Encoding', () => {
    test('Invalid Hydration swap parameters are rejected before encoding', async () => {
      await fc.assert(
        fc.asyncProperty(
          hydrationSwapParamsArbitrary(),
          async (validParams) => {
            // Create invalid variations
            const invalidVariations = [
              { ...validParams, tokenIn: '' },
              { ...validParams, tokenOut: '' },
              { ...validParams, tokenIn: validParams.tokenOut }, // Same tokens
              { ...validParams, amountIn: '0' },
              { ...validParams, minAmountOut: '0' },
              { ...validParams, recipient: '' },
              { ...validParams, deadline: Math.floor(Date.now() / 1000) - 1000 } // Past deadline
            ];

            // Each invalid variation should throw an error
            for (const invalidParams of invalidVariations) {
              await expect(encoder.encodeHydrationSwap(invalidParams)).rejects.toThrow();
            }
          }
        ),
        { numRuns: 20 } // Fewer runs since we test multiple variations per run
      );
    }, 30000);

    test('Invalid DEX swap parameters are rejected before encoding', async () => {
      await fc.assert(
        fc.asyncProperty(
          dexSwapParamsArbitrary(),
          async (validParams) => {
            // Create invalid variations
            const invalidVariations = [
              { ...validParams, tokenIn: '' },
              { ...validParams, tokenOut: '' },
              { ...validParams, amountIn: '0' },
              { ...validParams, minAmountOut: '0' },
              { ...validParams, path: [] }, // Empty path
              { ...validParams, recipient: 'invalid-address' },
              { ...validParams, deadline: Math.floor(Date.now() / 1000) - 1000 }
            ];

            // Each invalid variation should throw an error
            for (const invalidParams of invalidVariations) {
              await expect(encoder.encodeDEXSwap('stellaswap', invalidParams)).rejects.toThrow();
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);
  });
});
