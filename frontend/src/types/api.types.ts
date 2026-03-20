/**
 * API Request and Response Types
 * 
 * TypeScript interfaces for all API requests and responses
 */

import type { IntentParams, Strategy } from './index';

// ============================================================================
// Chat API Types
// ============================================================================

export interface ChatMessageRequest {
  message: string;
  userId: string;
  conversationId?: string;
}

export interface ChatMessageResponse {
  success: boolean;
  message: string;
  intentParams?: IntentParams;
  strategies?: Strategy[];
  confidence: number;
  conversationId: string;
  clarificationQuestion?: string;
}

// ============================================================================
// Intent API Types
// ============================================================================

export interface UnsignedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
}

export interface CreateIntentRequest {
  userId: string;
  intentParams: IntentParams;
  selectedStrategy: Strategy;
}

export interface CreateIntentResponse {
  success: boolean;
  intentId: number;
  unsignedTx: UnsignedTransaction;
  message: string;
}

export interface ApproveIntentRequest {
  intentId: number;
  userId: string;
}

export interface ApproveIntentResponse {
  success: boolean;
  unsignedTx: UnsignedTransaction;
  message: string;
}

export interface ExecuteIntentRequest {
  intentId: number;
  userId: string;
}

export interface ExecuteIntentResponse {
  success: boolean;
  unsignedTx: UnsignedTransaction;
  message: string;
}

// ============================================================================
// Execution Status API Types
// ============================================================================

export interface ExecutionInfo {
  intent_id: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_steps: number;
  completed_steps: number;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
}

export interface ExecutionStepInfo {
  id: number;
  intent_id: number;
  step_index: number;
  destination_para_id: number;
  target_contract: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tx_hash: string | null;
  executed_at: number | null;
  error?: string;
}

export interface XCMMessageInfo {
  id: number;
  intent_id: number;
  para_id: number;
  xcm_message_hash: string;
  status: 'pending' | 'dispatched' | 'confirmed' | 'failed';
  dispatched_at: number | null;
  confirmed_at: number | null;
}

export interface ExecutionStatusResponse {
  execution: ExecutionInfo;
  steps: ExecutionStepInfo[];
  xcmMessages: XCMMessageInfo[];
}

// ============================================================================
// Memory API Types
// ============================================================================

export interface Memory {
  id: string;
  userId: string;
  content: string;
  type: string;
  timestamp: number;
}

export interface GetMemoryResponse {
  success: boolean;
  memories: Memory[];
  count: number;
}

// ============================================================================
// Portfolio API Types
// ============================================================================

export enum TransactionType {
  SWAP = 'swap',
  TRANSFER = 'transfer',
  LIQUIDITY_ADD = 'liquidity_add',
  LIQUIDITY_REMOVE = 'liquidity_remove',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
}

export interface Transaction {
  hash: string;
  type: TransactionType;
  from: string;
  to: string;
  amount: string;
  valueUsd: number;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  chain?: string;
}

export interface TransactionHistoryRequest {
  limit?: number;
  offset?: number;
  type?: TransactionType;
  startDate?: number;
  endDate?: number;
}

export interface TransactionHistoryResponse {
  transactions: Transaction[];
  count: number;
  hasMore: boolean;
}

export interface PortfolioResponse {
  totalValueUsd: number;
  balances: any[];
  yieldPositions: any[];
  lastUpdated: number;
  isStale?: boolean;
}

export interface BalancesResponse {
  balances: any[];
  totalValueUsd: number;
  lastUpdated: number;
}

export interface YieldPositionsResponse {
  positions: any[];
  totalValueUsd: number;
  lastUpdated: number;
}

// ============================================================================
// Agent API Types
// ============================================================================

export interface AgentInfo {
  address: string;
  name?: string;
  reputation: number;
  totalExecutions: number;
  successRate: number;
  specialties: string[];
  isActive: boolean;
  stakeAmount?: string;
  registeredAt?: number;
  lastActiveAt?: number;
}

export interface AgentsListRequest {
  limit?: number;
  offset?: number;
  specialty?: string;
  minReputation?: number;
}

export interface AgentsListResponse {
  agents: AgentInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface AgentDetailsResponse {
  address: string;
  name?: string;
  reputation: number;
  totalExecutions: number;
  successRate: number;
  specialties: string[];
  isActive: boolean;
  stakeAmount: string;
  registeredAt: number;
  lastActiveAt: number;
}

export interface AgentExecutionInfo {
  intentId: number;
  status: string;
  gasUsed: string;
  executionTime: number;
  timestamp: number;
}

export interface AgentExecutionsRequest {
  limit?: number;
  offset?: number;
}

export interface AgentExecutionsResponse {
  executions: AgentExecutionInfo[];
  count: number;
}

export interface AgentStatsResponse {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  totalGasUsed: string;
  totalFeesEarned: string;
  reputation: number;
}
