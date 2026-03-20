// Core types for NexusAI Protocol frontend

// Wallet Provider Types
export enum WalletProvider {
  METAMASK = 'metamask',
  SUBWALLET = 'subwallet',
  TALISMAN = 'talisman',
}

export interface IntentParams {
  action: 'yield' | 'swap' | 'stake' | 'lend' | 'transfer' | 'bridge';
  asset: string;
  amount: string;
  riskTolerance: 'low' | 'medium' | 'high';
  minYieldBps?: number;
  maxLockDays?: number;
  deadline: number;
}

export interface Strategy {
  name: string;
  protocol: string;
  chain: string;
  pros: string[];
  cons: string[];
  explanation: string;
  estimatedGasUsd: number;
  // New API fields (from backend)
  apy?: number;
  risk?: 'low' | 'medium' | 'high';
  lockPeriod?: number;
  netApy?: number;
  // Legacy fields (kept for compatibility)
  estimatedApyBps?: number;
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  lockDays?: number;
  netApyBps?: number;
  sharpeRatio?: number;
  executionPlan?: ExecutionPlan;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
}

export interface ExecutionStep {
  destinationParaId: number;
  targetContract: string;
  callData: string;
  value: string;
}

export interface Balance {
  asset: string;
  chain: string;
  balance: string; // Changed from 'amount' to match API response
  valueUsd: number;
  decimals?: number;
  price?: number;
  paraId?: number;
}

export interface YieldPosition {
  id: string; // Changed from intentId to match API response
  protocol: string;
  chain?: string; // Made optional
  type?: 'liquidity_pool' | 'staking' | 'lending'; // Added type field
  pool?: string; // Added pool field
  asset?: string; // Made optional
  amount: string; // Changed from depositedAmount
  depositedAmount?: string; // Keep for backward compatibility
  currentValue?: string; // Made optional
  valueUsd: number; // Added from API
  apy?: number; // Added from API (in percentage, not bps)
  apyBps?: number; // Keep for backward compatibility
  rewards?: string; // Added from API
  rewardsUsd?: number; // Added from API
  accruedValue?: string;
  startDate?: number; // Added from API
  startedAt?: number; // Keep for backward compatibility
  lockPeriod?: number | null; // Added from API
}

export interface Portfolio {
  totalValueUsd: number;
  balances: Balance[];
  yieldPositions: YieldPosition[];
  lastUpdated: number;
  isStale?: boolean;
}

export interface Agent {
  address: string;
  stakeAmount: string;
  reputationScore: number;
  successCount: number;
  failCount: number;
  totalExecutions: number;
  isActive: boolean;
  metadataUri?: string;
  registeredAt: number;
}

export interface Intent {
  id: number;
  userAddress: string;
  amount: string;
  goalHash: string;
  maxSlippageBps: number;
  deadline: number;
  status: IntentStatus;
  assignedAgent?: string;
  executionPlanHash?: string;
  createdAt: number;
}

export enum IntentStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  PLAN_SUBMITTED = 'PLAN_SUBMITTED',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export interface ExecutionUpdate {
  type: 'intent_update' | 'xcm_sent' | 'execution_complete' | 'execution_failed';
  intentId: number;
  status?: string;
  currentStep?: number;
  totalSteps?: number;
  paraId?: number;
  txHash?: string;
  returnAmount?: string;
  error?: string;
  timestamp: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  strategies?: Strategy[];
  timestamp: number;
  planApproval?: {
    intentId: number;
    strategyName: string;
    executionPlan?: ExecutionPlan;
    estimatedTotalGasUsd?: number;
  };
  executeConfirmation?: {
    intentId: number;
    strategyName: string;
    estimatedGasUsd: number;
  };
}