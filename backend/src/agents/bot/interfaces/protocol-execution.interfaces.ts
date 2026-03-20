/**
 * Core interfaces for real protocol execution system
 * These interfaces define the contracts for actual DeFi protocol operations
 */

import { ethers } from 'ethers';

// ============================================================================
// Core Execution Types
// ============================================================================

export interface ExecutionPlan {
  intentId: number;
  steps: ExecutionStep[];
  totalSteps: number;
  estimatedDuration: number;
  estimatedGasCost: string;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
  securityChecks: SecurityCheck[];
  rollbackPlan: RollbackStep[];
}

export interface ExecutionStep {
  stepId: number;
  action: 'bridge' | 'swap' | 'stake' | 'provide_liquidity' | 'claim_rewards';
  protocol: string;
  chain: string;
  tokenIn?: string;
  tokenOut?: string;
  amount: string;
  minAmountOut?: string;
  contractAddress: string;
  callData: string;
  estimatedGas: string;
  description: string;
  prerequisites: string[];
  rollbackData?: string;
}

export interface RollbackStep {
  stepId: number;
  action: string;
  contractAddress: string;
  callData: string;
  description: string;
}

export interface SecurityCheck {
  type: 'balance' | 'approval' | 'slippage' | 'deadline' | 'limit';
  status: 'pending' | 'passed' | 'failed';
  message: string;
  data?: any;
}

// ============================================================================
// Protocol Integration Interfaces
// ============================================================================

// Protocol adapter type aliases (implementations in real-protocol-integration.service.ts)
export type HydrationAdapter = ProtocolAdapter;
export type BifrostAdapter = ProtocolAdapter;
export type StellaSwapAdapter = ProtocolAdapter;
export type BeamSwapAdapter = ProtocolAdapter;

export interface ProtocolIntegrationService {
  // Protocol-specific adapters
  hydrationAdapter: HydrationAdapter;
  bifrostAdapter: BifrostAdapter;
  stellaswapAdapter: StellaSwapAdapter;
  beamswapAdapter: BeamSwapAdapter;
  
  // Core methods
  generateExecutionPlan(intent: Intent): Promise<ExecutionPlan>;
  validateExecutionStep(step: ExecutionStep): Promise<ValidationResult>;
  estimateExecutionCost(steps: ExecutionStep[]): Promise<CostEstimate>;
  
  // Protocol discovery
  findBestYieldOpportunity(params: YieldParams): Promise<YieldOpportunity>;
  getProtocolHealth(): Promise<ProtocolHealthStatus>;
}

export interface ProtocolAdapter {
  name: string;
  chain: string;
  isActive: boolean;
  
  // Core operations
  encodeSwap(params: SwapParams): Promise<string>;
  encodeLiquidity(params: LiquidityParams): Promise<string>;
  encodeStaking(params: StakingParams): Promise<string>;
  
  // Validation
  validateParameters(params: any): Promise<ValidationResult>;
  estimateGas(callData: string): Promise<bigint>;
  
  // Health checks
  checkHealth(): Promise<boolean>;
}

// ============================================================================
// XCM Execution Interfaces
// ============================================================================

export interface XCMExecutor {
  // Message construction
  buildTransferMessage(params: XCMTransferParams): Promise<XCMMessage>;
  buildRemoteExecutionMessage(params: RemoteExecutionParams): Promise<XCMMessage>;
  
  // Execution
  sendXCMMessage(message: XCMMessage): Promise<XCMResult>;
  trackMessageDelivery(messageId: string): Promise<DeliveryStatus>;
  
  // Fee calculation
  calculateXCMFee(params: XCMFeeParams): Promise<FeeEstimate>;
  
  // Validation
  validateXCMMessage(message: XCMMessage): Promise<ValidationResult>;
}

export interface XCMMessage {
  version: number;
  destination: MultiLocation;
  message: Instruction[];
  weight: Weight;
  fee: bigint;
  messageId: string;
  sender: string;
  recipient: string;
}

export interface MultiLocation {
  parents: number;
  interior: Junctions;
}

export interface Junctions {
  here?: null;
  x1?: Junction;
  x2?: [Junction, Junction];
  x3?: [Junction, Junction, Junction];
}

export interface Junction {
  parachain?: number;
  accountId32?: {
    network: string;
    id: string;
  };
  accountKey20?: {
    network: string;
    key: string;
  };
}

export interface Instruction {
  withdrawAsset?: Asset[];
  buyExecution?: {
    fees: Asset;
    weightLimit: WeightLimit;
  };
  depositAsset?: {
    assets: AssetFilter;
    maxAssets: number;
    beneficiary: MultiLocation;
  };
}

export interface Asset {
  id: AssetId;
  fun: Fungibility;
}

export interface AssetId {
  concrete?: MultiLocation;
  abstract?: string;
}

export interface Fungibility {
  fungible?: bigint;
  nonFungible?: any;
}

export interface AssetFilter {
  definite?: Asset[];
  wild?: WildAsset;
}

export interface WildAsset {
  all?: null;
  allOf?: {
    id: AssetId;
    fun: WildFungibility;
  };
}

export interface WildFungibility {
  fungible?: null;
  nonFungible?: null;
}

export interface WeightLimit {
  unlimited?: null;
  limited?: Weight;
}

export interface Weight {
  refTime: bigint;
  proofSize: bigint;
}

// ============================================================================
// Fund Management Interfaces
// ============================================================================

export interface FundManager {
  // Fund movement
  transferFunds(params: TransferParams): Promise<TransferResult>;
  bridgeFunds(params: BridgeParams): Promise<BridgeResult>;
  
  // Security controls
  validateTransfer(params: TransferParams): Promise<ValidationResult>;
  checkUserLimits(userAddress: string, amount: bigint): Promise<LimitCheck>;
  
  // Custody management
  getBalance(address: string, token: string): Promise<bigint>;
  trackFundMovement(txHash: string): Promise<MovementStatus>;
  
  // Emergency controls
  pauseFundMovements(): Promise<void>;
  resumeFundMovements(): Promise<void>;
}

export interface TransferParams {
  from: string;
  to: string;
  token: string;
  amount: string;
  chain: string;
  userAddress: string;
  intentId: number;
}

export interface BridgeParams extends TransferParams {
  destinationChain: string;
  destinationAddress: string;
  xcmFee: string;
}

export interface TransferResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: string;
  movementId: string;
}

export interface BridgeResult extends TransferResult {
  xcmMessageId?: string;
  estimatedDeliveryTime: number;
}

// ============================================================================
// Call Data Encoder Interfaces
// ============================================================================

export interface CallDataEncoder {
  // Hydration encoding
  encodeHydrationSwap(params: HydrationSwapParams): Promise<string>;
  encodeHydrationLiquidity(params: HydrationLiquidityParams): Promise<string>;
  
  // Bifrost encoding
  encodeBifrostMint(params: BifrostMintParams): Promise<string>;
  encodeBifrostRedeem(params: BifrostRedeemParams): Promise<string>;
  
  // Moonbeam DEX encoding
  encodeDEXSwap(protocol: string, params: DEXSwapParams): Promise<string>;
  encodeLiquidityProvision(protocol: string, params: LiquidityParams): Promise<string>;
  
  // Validation
  validateCallData(callData: string, expectedFunction: string): Promise<boolean>;
  decodeCallData(callData: string): Promise<DecodedCall>;
}

export interface DecodedCall {
  functionName: string;
  parameters: Record<string, any>;
  isValid: boolean;
}

// ============================================================================
// Transaction Builder Interfaces
// ============================================================================

export interface TransactionBuilder {
  // Transaction construction
  buildTransaction(params: TransactionParams): Promise<UnsignedTransaction>;
  signTransaction(tx: UnsignedTransaction, wallet: ethers.Wallet | ethers.HDNodeWallet): Promise<SignedTransaction>;
  
  // Gas optimization
  estimateGas(tx: UnsignedTransaction): Promise<bigint>;
  optimizeGasPrice(urgency: 'low' | 'medium' | 'high'): Promise<bigint>;
  
  // Execution
  submitTransaction(tx: SignedTransaction): Promise<TransactionResult>;
  waitForConfirmation(txHash: string, confirmations: number): Promise<ethers.TransactionReceipt>;
  
  // Batch operations
  buildBatchTransaction(txs: UnsignedTransaction[]): Promise<BatchTransaction>;
}

export interface UnsignedTransaction {
  to: string;
  data: string;
  value: bigint;
  gasLimit: bigint;
  gasPrice: bigint;
  nonce: number;
  chainId: number;
}

export interface SignedTransaction extends UnsignedTransaction {
  signature: {
    r: string;
    s: string;
    v: number;
  };
  hash: string;
}

export interface TransactionResult {
  success: boolean;
  transactionHash: string;
  blockNumber?: number;
  gasUsed?: bigint;
  error?: string;
}

export interface BatchTransaction {
  transactions: UnsignedTransaction[];
  totalGasLimit: bigint;
  estimatedCost: string;
}

// ============================================================================
// Protocol-Specific Parameter Types
// ============================================================================

export interface HydrationSwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  recipient: string;
  deadline: number;
}

export interface HydrationLiquidityParams {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  minAmountA: string;
  minAmountB: string;
  recipient: string;
  deadline: number;
}

export interface BifrostMintParams {
  asset: string;
  amount: string;
  recipient: string;
}

export interface BifrostRedeemParams {
  vAsset: string;
  amount: string;
  recipient: string;
  fastRedeem: boolean;
}

export interface DEXSwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  path: string[];
  recipient: string;
  deadline: number;
}

export interface LiquidityParams {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  minAmountA: string;
  minAmountB: string;
  recipient: string;
  deadline: number;
}

export interface StakingParams {
  asset: string;
  amount: string;
  validator?: string;
  recipient: string;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  recipient: string;
  deadline: number;
}

// ============================================================================
// XCM-Specific Parameter Types
// ============================================================================

export interface XCMTransferParams {
  fromChain: string;
  toChain: string;
  asset: string;
  amount: string;
  sender: string;
  recipient: string;
  fee: string;
}

export interface RemoteExecutionParams {
  targetChain: string;
  contractAddress: string;
  callData: string;
  sender: string;
  fee: string;
  weight: Weight;
}

export interface XCMFeeParams {
  fromChain: string;
  toChain: string;
  asset: string;
  amount: string;
}

export interface XCMResult {
  success: boolean;
  messageId: string;
  transactionHash: string;
  error?: string;
}

export interface DeliveryStatus {
  messageId: string;
  status: 'pending' | 'delivered' | 'failed' | 'timeout';
  blockNumber?: number;
  error?: string;
  deliveryTime?: number;
}

// ============================================================================
// Validation and Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CostEstimate {
  totalGas: bigint;
  estimatedCostETH: string;
  estimatedCostUSD: string;
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  step: number;
  operation: string;
  gasEstimate: bigint;
  costETH: string;
}

export interface YieldParams {
  asset: string;
  amount: string;
  riskTolerance: 'low' | 'medium' | 'high';
  duration?: number;
}

export interface YieldOpportunity {
  protocol: string;
  strategy: string;
  expectedApy: number;
  estimatedReturns: string;
  riskLevel: string;
  requirements: string[];
}

export interface ProtocolHealthStatus {
  protocol: string;
  isHealthy: boolean;
  lastCheck: Date;
  issues: string[];
  metrics: {
    responseTime: number;
    successRate: number;
    tvl: string;
  };
}

export interface LimitCheck {
  withinLimits: boolean;
  currentUsage: string;
  limit: string;
  timeWindow: string;
  resetTime?: Date;
}

export interface MovementStatus {
  movementId: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  requiredConfirmations: number;
  estimatedCompletion?: Date;
}

export interface FeeEstimate {
  fee: string;
  currency: string;
  estimatedTime: number;
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ProtocolConfig {
  name: string;
  chain: string;
  contracts: {
    router?: string;
    factory?: string;
    staking?: string;
    rewards?: string;
  };
  tokens: Record<string, string>;
  fees: {
    swap: number;
    liquidity: number;
    staking: number;
  };
  limits: {
    minAmount: string;
    maxAmount: string;
    maxSlippage: number;
  };
  isActive: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TransactionParams {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  gasPrice?: string;
  nonce?: number;
  chainId: number;
}

// ============================================================================
// Intent and Context Types
// ============================================================================

export interface Intent {
  id: number;
  userAddress: string;
  goalHash: string;
  amount: bigint;
  deadline: number;
  maxSlippageBps: number;
  approvedProtocols: string[];
  status: string;
}

export interface ExecutionContext {
  intentId: number;
  agentAddress: string;
  wallet: ethers.HDNodeWallet;
  provider: ethers.JsonRpcProvider;
  maxGasPrice: bigint;
  slippageTolerance: number;
}

// ============================================================================
// Fund Movement Record Types
// ============================================================================

export interface FundMovementRecord {
  id: string;
  intentId: number;
  fromAddress: string;
  toAddress: string;
  token: string;
  amount: string;
  chain: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed: string;
  fees: string;
  movementType: 'transfer' | 'bridge' | 'swap' | 'stake';
}

export interface SecurityValidationContext {
  intentId: number;
  agentAddress: string;
  userAddress: string;
  protocols: string[];
  totalValue: string;
  riskLevel: 'low' | 'medium' | 'high';
  deadline: number;
  slippageTolerance: number;
  requiresTimelock: boolean;
  emergencyPauseCheck: boolean;
}