import { IsString, IsEthereumAddress, IsInt, Min } from 'class-validator';

export class GetExecutionParamsDto {
  @IsInt()
  @Min(1)
  intentId!: number;
}

export interface Execution {
  intent_id: number;
  status: string;
  total_steps: number;
  completed_steps: number;
  started_at: number;
  completed_at?: number;
  error_message?: string;
}

export interface ExecutionStep {
  id: number;
  intent_id: number;
  step_index: number;
  destination_para_id: number;
  target_contract?: string;
  call_data?: string;
  value?: string;
  status: string;
  tx_hash?: string;
  executed_at?: number;
}

export interface XCMMessage {
  id: number;
  intent_id: number;
  para_id: number;
  xcm_message_hash: string;
  xcm_message_bytes: string;
  status: string;
  dispatched_at: number;
  confirmed_at?: number;
}