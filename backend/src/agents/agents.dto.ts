import { IsString, IsEthereumAddress, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

export class GetAgentsQueryDto {
  @IsOptional()
  @IsEnum(['reputation', 'volume', 'success_rate'])
  sort?: 'reputation' | 'volume' | 'success_rate' = 'reputation';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class GetAgentParamsDto {
  @IsString()
  @IsEthereumAddress()
  address!: string;
}

export interface Agent {
  address: string;
  stake_amount: string;
  reputation_score: number;
  success_count: number;
  fail_count: number;
  total_executions: number;
  is_active: boolean;
  metadata_uri?: string;
  metadata_json?: any;
  registered_at: number;
  updated_at: number;
}

export interface AgentExecution {
  id: number;
  user_address: string;
  amount: string;
  status: string;
  execution_status?: string;
  created_at: number;
  completed_at?: number;
}