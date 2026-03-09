/**
 * API Types and Interfaces
 * 
 * TypeScript interfaces for API requests, responses, and business logic.
 * These complement the database types with application-specific structures.
 */

import { IntentStatus, ExecutionStatus } from './database.types';

/**
 * Intent Parsing and Creation Types
 */

export interface IntentParams {
  action: 'yield' | 'swap' | 'stake' | 'lend' | 'transfer' | 'bridge';
  asset: string;
  amount: string;
  riskTolerance: 'low' | 'medium' | 'high';
  minYieldBps?: number;
  maxLockDays?: number;
  deadline: number;
  approvedProtocols?: string[];
  naturalLanguageGoal?: string;
}

export interface ParseResult {
  success: boolean;
  confidence: number;
  intentParams?: IntentParams;
  clarificationQuestion?: string;
  conversationId?: string;
}

/**
 * Strategy and Yield Types
 */

export interface YieldOption {
  protocol: string;
  chain: string;
  paraId: number;
  asset: string;
  apyBps: number;
  tvlUsd: number;
  lockDays: number;
  auditStatus: 'audited' | 'partial' | 'unaudited';
  contractAddress: string;
  requiresXCM: boolean;
  lastUpdated: number;
}

export interface RiskScore {
  overall: number; // 0-100
  contractRisk: number;
  ilRisk: number; // Impermanent Loss risk
  lockRisk: number;
  tvlRisk: number;
  volatilityRisk: number;
}

export interface RiskAssessment {
  overallScore: number; // 0-100
  factors: Array<{
    name: string;
    score: number;
    reason: string;
  }>;
  recommendations: string[];
  warnings: string[];
  confidence: number; // 0-100
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
  riskAssessment?: RiskAssessment;
}

/**
 * Execution Plan Types
 */

export interface ExecutionStep {
  destinationParaId: number; // 0 for local execution
  targetContract: string;
  callData: string;
  value: string; // wei amount as string
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  totalSteps: number;
  estimatedGas: string;
  description: string;
}

/**
 * Gas Estimation Types
 */

export interface GasEstimate {
  createIntentGas: bigint;
  approvePlanGas: bigint;
  executeIntentGas: bigint;
  xcmGas: bigint[];
  totalGas: bigint;
  gasPrice: bigint;
  totalCostWei: bigint;
  totalCostUsd: number;
}

/**
 * Portfolio Types
 */

export interface Balance {
  asset: string;
  chain: string;
  amount: string;
  valueUsd: number;
}

export interface YieldPosition {
  intentId: string;
  protocol: string;
  chain: string;
  asset: string;
  depositedAmount: string;
  currentValue: string;
  apyBps: number;
  accruedValue: string;
  startedAt: string;
}

export interface Portfolio {
  totalValueUsd: number;
  balances: Balance[];
  yieldPositions: YieldPosition[];
  lastUpdated: number;
  isStale?: boolean;
}

/**
 * WebSocket Types
 */

export interface ExecutionUpdate {
  type: 'intent_update' | 'xcm_sent' | 'execution_complete' | 'execution_failed';
  intentId: string;
  status?: IntentStatus | ExecutionStatus;
  currentStep?: number;
  totalSteps?: number;
  paraId?: number;
  txHash?: string;
  returnAmount?: string;
  error?: string;
  timestamp: number;
}

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'update';
  intentId?: string;
  userId?: string;
  data?: ExecutionUpdate;
}

/**
 * Memory and AI Types
 */

export interface Memory {
  id: string;
  userId: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
  relevanceScore?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  strategies?: Strategy[];
  timestamp: number;
  conversationId?: string;
}

/**
 * API Request/Response Types
 */

// Chat API
export interface ChatMessageRequest {
  message: string;
  userId: string;
  conversationId?: string;
}

export interface ChatMessageResponse {
  success: boolean;
  confidence: number;
  strategies?: Strategy[];
  clarificationQuestion?: string;
  conversationId: string;
  message: string;
}

// Intent API
export interface CreateIntentRequest {
  userId: string;
  intentParams: IntentParams;
  selectedStrategy: Strategy;
}

export interface CreateIntentResponse {
  unsignedTx: UnsignedTransaction;
  intentId: string;
}

export interface ApproveIntentRequest {
  intentId: string;
  userId: string;
}

export interface ExecuteIntentRequest {
  intentId: string;
  userId: string;
}

// Transaction Types
export interface UnsignedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  gasPrice?: string;
}

// Portfolio API
export interface PortfolioResponse extends Portfolio {}

// Agent API
export interface AgentListRequest {
  sort?: 'reputation' | 'volume' | 'success_rate';
  limit?: number;
  offset?: number;
}

export interface AgentListResponse {
  agents: AgentWithMetrics[];
  total: number;
}

export interface AgentDetailResponse {
  agent: AgentWithMetrics;
  recentExecutions: ExecutionWithDetails[];
}

// Yield API
export interface YieldListResponse {
  yields: YieldOption[];
  lastUpdated: number;
}

/**
 * Error Types
 */

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface ValidationError extends ApiError {
  field: string;
  value: any;
  constraint: string;
}

/**
 * Configuration Types
 */

export interface ChainConfig {
  chainId: string;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface ContractConfig {
  address: string;
  abi: any[];
  deployedBlock: number;
}

/**
 * Utility Types
 */

// Make all properties optional for partial updates
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Extract specific fields from a type
export type PickFields<T, K extends keyof T> = Pick<T, K>;

// Omit specific fields from a type
export type OmitFields<T, K extends keyof T> = Omit<T, K>;

// Convert bigint fields to string for JSON serialization
export type SerializeBigInt<T> = {
  [K in keyof T]: T[K] extends bigint ? string : T[K];
};

// Type for database query filters
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike';

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

// Import types from database for re-export
import type {
  Agent as DbAgent,
  Intent as DbIntent,
  Execution as DbExecution,
  AgentWithMetrics,
  ExecutionWithDetails,
} from './database.types';