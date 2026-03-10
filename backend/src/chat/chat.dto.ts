import { IsString, IsNotEmpty, IsEthereumAddress, IsOptional, IsEnum, IsNumber, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsEthereumAddress()
  userId!: string; // wallet address

  @IsString()
  @IsOptional()
  conversationId?: string;
}

export class IntentParamsDto {
  @IsEnum(['yield', 'swap', 'stake', 'lend', 'transfer', 'bridge'])
  action!: 'yield' | 'swap' | 'stake' | 'lend' | 'transfer' | 'bridge';

  @IsString()
  @IsNotEmpty()
  asset!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsEnum(['low', 'medium', 'high'])
  riskTolerance!: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  minYieldBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  maxLockDays?: number;

  @IsNumber()
  @Min(Date.now() / 1000)
  deadline!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  confidence!: number;
}

export interface ParseResult {
  success: boolean;
  confidence: number;
  intentParams?: IntentParams;
  clarificationQuestion?: string;
  conversationId?: string;
}

export interface IntentParams {
  action: 'yield' | 'swap' | 'stake' | 'lend' | 'transfer' | 'bridge';
  asset: string;
  amount: string;
  riskTolerance: 'low' | 'medium' | 'high';
  minYieldBps?: number;
  maxLockDays?: number;
  deadline: number;
  confidence: number;
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