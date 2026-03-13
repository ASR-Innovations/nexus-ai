// Core types for NexusAI Protocol frontend

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
  estimatedApyBps: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  lockDays: number;
  netApyBps: number;
  sharpeRatio: number;
  pros: string[];
  cons: string[];
  explanation: string;
  executionPlan: ExecutionPlan;
  estimatedGasUsd: number;
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
  amount: string;
  valueUsd: number;
}

export interface YieldPosition {
  intentId: number;
  protocol: string;
  chain: string;
  asset: string;
  depositedAmount: string;
  currentValue: string;
  apyBps: number;
  accruedValue: string;
  startedAt: number;
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
  };
  executeConfirmation?: {
    intentId: number;
    strategyName: string;
    estimatedGasUsd: number;
  };
}