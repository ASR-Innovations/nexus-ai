// Contract Types and Interfaces for NexusAI Protocol
// Generated from contract ABIs

export interface Intent {
  user: string;
  amount: bigint;
  goalHash: string;
  maxSlippageBps: bigint;
  deadline: bigint;
  minYieldBps: bigint;
  maxLockDuration: bigint;
  approvedProtocols: string[];
  status: IntentStatus;
  assignedAgent: string;
  executionPlan: string;
  executionPlanHash: string;
  createdAt: bigint;
}

export enum IntentStatus {
  PENDING = 0,
  ASSIGNED = 1,
  PLAN_SUBMITTED = 2,
  APPROVED = 3,
  EXECUTING = 4,
  AWAITING_CONFIRMATION = 5,
  COMPLETED = 6,
  FAILED = 7,
  CANCELLED = 8,
  EXPIRED = 9
}

export interface Agent {
  stakeAmount: bigint;
  reputationScore: bigint;
  successCount: bigint;
  failCount: bigint;
  totalExecutions: bigint;
  isActive: boolean;
  metadataURI: string;
  registeredAt: bigint;
}

export interface Execution {
  intentId: bigint;
  status: ExecutionStatus;
  totalSteps: bigint;
  completedSteps: bigint;
  startedAt: bigint;
}

export enum ExecutionStatus {
  IN_PROGRESS = 0,
  AWAITING_CONFIRMATION = 1,
  COMPLETED = 2,
  FAILED = 3
}

export interface ExecutionStep {
  destinationParaId: number;
  targetContract: string;
  callData: string;
  value: bigint;
}

// Contract Event Interfaces
export interface IntentCreatedEvent {
  intentId: bigint;
  user: string;
  amount: bigint;
  goalHash: string;
}

export interface IntentAssignedEvent {
  intentId: bigint;
  agent: string;
}

export interface PlanSubmittedEvent {
  intentId: bigint;
  executionPlanHash: string;
}

export interface PlanApprovedEvent {
  intentId: bigint;
}

export interface IntentExecutedEvent {
  intentId: bigint;
  protocolFee: bigint;
}

export interface ExecutionCompletedEvent {
  intentId: bigint;
  returnAmount: bigint;
}

export interface ExecutionFailedEvent {
  intentId: bigint;
  reason: string;
}

export interface FundsReturnedEvent {
  intentId: bigint;
  user: string;
  amount: bigint;
}

export interface IntentCancelledEvent {
  intentId: bigint;
  user: string;
}

export interface IntentExpiredEvent {
  intentId: bigint;
  user: string;
}

export interface AgentRegisteredEvent {
  agent: string;
  stake: bigint;
  metadataURI: string;
}

export interface AgentSlashedEvent {
  agent: string;
  slashAmount: bigint;
}

export interface ReputationUpdatedEvent {
  agent: string;
  newScore: bigint;
}

export interface AgentDeactivatedEvent {
  agent: string;
}

export interface ExecutionStartedEvent {
  intentId: bigint;
  totalSteps: bigint;
}

export interface StepExecutedEvent {
  intentId: bigint;
  stepIndex: bigint;
  paraId: number;
}

export interface XCMSentEvent {
  intentId: bigint;
  paraId: number;
  xcmMessage: string;
}

export interface ExecutionDispatchedEvent {
  intentId: bigint;
}

// Transaction Building Types
export interface UnsignedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  gasPrice?: string;
}

export interface CreateIntentParams {
  goalHash: string;
  maxSlippageBps: number;
  deadline: number;
  minYieldBps: number;
  maxLockDuration: number;
  approvedProtocols: string[];
  value: bigint;
}

export interface RegisterAgentParams {
  metadataURI: string;
  value: bigint;
}

export interface ExecuteIntentParams {
  intentId: bigint;
  planData: string;
  value: bigint;
}

// Contract Constants
export const CONTRACT_CONSTANTS = {
  MIN_DEPOSIT: BigInt('1000000000000000000'), // 1 ether
  MAX_SLIPPAGE_BPS: 1000,
  PROTOCOL_FEE_BPS: 30,
  MIN_STAKE: BigInt('10000000000000000000'), // 10 ether
  INITIAL_REPUTATION: 5000,
  SLASH_PERCENT: 10,
  XCM_PRECOMPILE: '0x0000000000000000000000000000000000000a00'
} as const;

// Supported Parachain IDs
export const PARACHAIN_IDS = {
  POLKADOT_HUB: 0,
  HYDRATION: 2034,
  BIFROST: 2030,
  MOONBEAM: 2004
} as const;