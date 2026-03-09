import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from '../shared/database.provider';

@Injectable()
export class ExecutionService {
  constructor(private databaseProvider: DatabaseProvider) {}

  async getExecution(intentId: number) {
    try {
      const executionResult = await this.databaseProvider.query(
        'SELECT * FROM executions WHERE intent_id = $1',
        [intentId]
      );

      const stepsResult = await this.databaseProvider.query(
        'SELECT * FROM execution_steps WHERE intent_id = $1 ORDER BY step_index',
        [intentId]
      );

      const xcmResult = await this.databaseProvider.query(
        'SELECT * FROM xcm_messages WHERE intent_id = $1',
        [intentId]
      );

      return {
        execution: executionResult.rows[0] || null,
        steps: stepsResult.rows,
        xcmMessages: xcmResult.rows,
      };
    } catch (error) {
      console.error('Get execution error:', error);
      throw error;
    }
  }
}