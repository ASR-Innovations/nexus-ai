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