/**
 * Protocol-specific adapter interfaces for real DeFi integrations
 * Each adapter handles the specifics of interacting with a particular protocol
 */

import { 
  ProtocolAdapter, 
  ValidationResult, 
  SwapParams, 
  LiquidityParams, 
  StakingParams,
  HydrationSwapParams,
  HydrationLiquidityParams,
  BifrostMintParams,
  BifrostRedeemParams,
  DEXSwapParams
} from './protocol-execution.interfaces';

// ============================================================================
// Hydration Protocol Adapter
// ============================================================================

export interface HydrationAdapter extends ProtocolAdapter {
  // Hydration-specific operations
  encodeOmnipoolSwap(params: HydrationSwapParams): Promise<string>;
  encodeOmnipoolLiquidity(params: HydrationLiquidityParams): Promise<string>;
  
  // Pool management
  getPoolInfo(tokenA: string, tokenB: string): Promise<HydrationPoolInfo>;
  calculateSwapOutput(tokenIn: string, tokenOut: string, amountIn: string): Promise<string>;
  
  // Validation
  validateSwapParams(params: HydrationSwapParams): Promise<ValidationResult>;
  validateLiquidityParams(params: HydrationLiquidityParams): Promise<ValidationResult>;
}

export interface HydrationPoolInfo {
  poolId: number;
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  fee: number;
  apy: number;
  tvl: string;
  isActive: boolean;
}

// ============================================================================
// Bifrost Protocol Adapter
// ============================================================================

export interface BifrostAdapter extends ProtocolAdapter {
  // Liquid staking operations
  encodeMintVToken(params: BifrostMintParams): Promise<string>;
  encodeRedeemVToken(params: BifrostRedeemParams): Promise<string>;
  
  // Staking info
  getStakingInfo(asset: string): Promise<BifrostStakingInfo>;
  calculateMintOutput(asset: string, amount: string): Promise<string>;
  calculateRedeemOutput(vAsset: string, amount: string): Promise<string>;
  
  // Validation
  validateMintParams(params: BifrostMintParams): Promise<ValidationResult>;
  validateRedeemParams(params: BifrostRedeemParams): Promise<ValidationResult>;
}

export interface BifrostStakingInfo {
  asset: string;
  vAsset: string;
  exchangeRate: number;
  apy: number;
  totalStaked: string;
  unbondingPeriod: number;
  minimumStake: string;
  isActive: boolean;
}

// ============================================================================
// StellaSwap Protocol Adapter
// ============================================================================

export interface StellaSwapAdapter extends ProtocolAdapter {
  // AMM operations
  encodeSwapExactTokensForTokens(params: DEXSwapParams): Promise<string>;
  encodeAddLiquidity(params: LiquidityParams): Promise<string>;
  encodeRemoveLiquidity(params: RemoveLiquidityParams): Promise<string>;
  
  // Pool management
  getPairInfo(tokenA: string, tokenB: string): Promise<StellaSwapPairInfo>;
  getOptimalSwapPath(tokenIn: string, tokenOut: string): Promise<string[]>;
  
  // Validation
  validateSwapPath(path: string[]): Promise<ValidationResult>;
  validateLiquidityAmounts(params: LiquidityParams): Promise<ValidationResult>;
}

export interface StellaSwapPairInfo {
  pairAddress: string;
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  fee: number;
  apy: number;
  volume24h: string;
  isActive: boolean;
}

// ============================================================================
// BeamSwap Protocol Adapter
// ============================================================================

export interface BeamSwapAdapter extends ProtocolAdapter {
  // AMM operations
  encodeSwapExactTokensForTokens(params: DEXSwapParams): Promise<string>;
  encodeAddLiquidity(params: LiquidityParams): Promise<string>;
  encodeRemoveLiquidity(params: RemoveLiquidityParams): Promise<string>;
  
  // Pool management
  getPairInfo(tokenA: string, tokenB: string): Promise<BeamSwapPairInfo>;
  getOptimalSwapPath(tokenIn: string, tokenOut: string): Promise<string[]>;
  
  // Validation
  validateSwapPath(path: string[]): Promise<ValidationResult>;
  validateLiquidityAmounts(params: LiquidityParams): Promise<ValidationResult>;
}

export interface BeamSwapPairInfo {
  pairAddress: string;
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  fee: number;
  apy: number;
  volume24h: string;
  isActive: boolean;
}

// ============================================================================
// Common Types for DEX Operations
// ============================================================================

export interface RemoveLiquidityParams {
  tokenA: string;
  tokenB: string;
  liquidity: string;
  minAmountA: string;
  minAmountB: string;
  recipient: string;
  deadline: number;
}

export interface PoolReserves {
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  blockTimestampLast: number;
}

export interface SwapQuote {
  amountOut: string;
  priceImpact: number;
  fee: string;
  route: string[];
  gasEstimate: string;
}

export interface LiquidityQuote {
  amountA: string;
  amountB: string;
  liquidity: string;
  shareOfPool: number;
  gasEstimate: string;
}

// ============================================================================
// Protocol Health and Monitoring
// ============================================================================

export interface ProtocolHealthCheck {
  protocol: string;
  chain: string;
  isHealthy: boolean;
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  issues: ProtocolIssue[];
}

export interface ProtocolIssue {
  type: 'connectivity' | 'contract' | 'liquidity' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ProtocolError extends Error {
  protocol: string;
  operation: string;
  code: string;
  recoverable: boolean;
  retryAfter?: number;
  details?: any;
}

export interface AdapterError extends Error {
  adapter: string;
  method: string;
  parameters: any;
  cause?: Error;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AdapterConfig {
  name: string;
  chain: string;
  rpcEndpoint: string;
  contracts: Record<string, string>;
  tokens: Record<string, TokenConfig>;
  limits: AdapterLimits;
  fees: AdapterFees;
  timeouts: AdapterTimeouts;
}

export interface TokenConfig {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  isActive: boolean;
}

export interface AdapterLimits {
  minSwapAmount: string;
  maxSwapAmount: string;
  minLiquidityAmount: string;
  maxLiquidityAmount: string;
  maxSlippage: number;
  maxPriceImpact: number;
}

export interface AdapterFees {
  swapFee: number;
  liquidityFee: number;
  protocolFee: number;
  gasFeeMultiplier: number;
}

export interface AdapterTimeouts {
  rpcTimeout: number;
  transactionTimeout: number;
  confirmationTimeout: number;
  retryDelay: number;
  maxRetries: number;
}

// ============================================================================
// Factory Interface for Creating Adapters
// ============================================================================

export interface ProtocolAdapterFactory {
  createHydrationAdapter(config: AdapterConfig): HydrationAdapter;
  createBifrostAdapter(config: AdapterConfig): BifrostAdapter;
  createStellaSwapAdapter(config: AdapterConfig): StellaSwapAdapter;
  createBeamSwapAdapter(config: AdapterConfig): BeamSwapAdapter;
  
  // Registry management
  registerAdapter(name: string, adapter: ProtocolAdapter): void;
  getAdapter(name: string): ProtocolAdapter | null;
  listAdapters(): string[];
}

// ============================================================================
// Adapter Registry Interface
// ============================================================================

export interface AdapterRegistry {
  // Registration
  register(name: string, adapter: ProtocolAdapter): void;
  unregister(name: string): void;
  
  // Retrieval
  get(name: string): ProtocolAdapter | null;
  getByChain(chain: string): ProtocolAdapter[];
  getByProtocol(protocol: string): ProtocolAdapter | null;
  
  // Management
  list(): AdapterInfo[];
  isRegistered(name: string): boolean;
  getHealth(): AdapterHealthSummary[];
}

export interface AdapterInfo {
  name: string;
  protocol: string;
  chain: string;
  isActive: boolean;
  lastHealthCheck: Date;
  capabilities: string[];
}

export interface AdapterHealthSummary {
  name: string;
  isHealthy: boolean;
  lastCheck: Date;
  issues: number;
  responseTime: number;
}