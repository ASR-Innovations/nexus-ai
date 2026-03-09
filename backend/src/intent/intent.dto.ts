import { IsString, IsNotEmpty, IsEthereumAddress, IsNumber, IsObject, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IntentParams, IntentParamsDto } from '../chat/chat.dto';

export class CreateIntentDto {
  @IsString()
  @IsEthereumAddress()
  userId!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => IntentParamsDto)
  intentParams!: IntentParams;

  @IsObject()
  selectedStrategy!: any; // TODO: Define Strategy interface
}

export class ApproveIntentDto {
  @IsInt()
  @Min(1)
  intentId!: number;

  @IsString()
  @IsEthereumAddress()
  userId!: string;
}

export class ExecuteIntentDto {
  @IsInt()
  @Min(1)
  intentId!: number;

  @IsString()
  @IsEthereumAddress()
  userId!: string;
}

export interface Intent {
  id: number;
  user_address: string;
  amount: string;
  goal_hash: string;
  max_slippage_bps: number;
  deadline: number;
  status: string;
  assigned_agent?: string;
  execution_plan_hash?: string;
  created_at: number;
  updated_at: number;
}