import { IsString, IsNumber, IsEnum, IsOptional, IsArray } from 'class-validator';

export class GetStrategiesDto {
  @IsString()
  action!: 'yield' | 'swap' | 'stake' | 'lend' | 'transfer' | 'bridge';

  @IsString()
  asset!: string;

  @IsString()
  amount!: string;

  @IsEnum(['low', 'medium', 'high'])
  riskTolerance!: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsNumber()
  minYieldBps?: number;

  @IsOptional()
  @IsNumber()
  maxLockDays?: number;

  @IsOptional()
  @IsNumber()
  deadline?: number;
}

export interface YieldData {
  protocol: string;
  chain: string;
  asset: string;
  apyBps: number;
  tvlUsd: number;
  lockDays: number;
  riskLevel: 'low' | 'medium' | 'high';
  auditStatus: 'audited' | 'partial' | 'unaudited';
  lastUpdated: number;
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
  // Additional properties for internal use
  id?: string;
  asset?: string;
  tvlUsd?: number;
  auditStatus?: 'audited' | 'partial' | 'unaudited';
  gasEstimateUsd?: number;
  steps?: string[];
  requirements?: string[];
  warnings?: string[];
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  totalSteps: number;
  estimatedGas: string;
  description: string;
}

export interface ExecutionStep {
  destinationParaId: number;
  targetContract: string;
  callData: string;
  value: string;
}

export interface RiskAssessment {
  overallScore: number;
  factors: Array<{
    name: string;
    score: number;
    reason: string;
  }>;
  recommendations: string[];
  warnings: string[];
  confidence: number;
}