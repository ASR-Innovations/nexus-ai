/**
 * Timelock Controller
 * 
 * REST API endpoints for managing timelock operations.
 * Provides scheduling, execution, and status checking capabilities.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger
} from '@nestjs/common';
import { SecurityService } from '../services/security.service';
import { TimelockExecutionGuard, TimelockProtected } from '../guards/timelock-execution.guard';
import {
  TimelockOperationType,
  CreateTimelockOperationParams,
  TimelockOperationWithDetails
} from '../types/timelock.types';

export class CreateTimelockOperationDto {
  type!: TimelockOperationType;
  parameters!: Record<string, any>;
  createdBy!: string;
  delayDays?: number;
}

export class ExecuteTimelockOperationDto {
  operationId!: string;
}

@Controller('timelock')
export class TimelockController {
  private readonly logger = new Logger(TimelockController.name);

  constructor(private readonly securityService: SecurityService) {}

  /**
   * Schedule a new timelock operation
   */
  @Post('schedule')
  async scheduleOperation(@Body() dto: CreateTimelockOperationDto) {
    try {
      this.logger.log(`Scheduling timelock operation: ${dto.type}`);
      
      const operationId = await this.securityService.scheduleTimelockOperation(dto);
      
      return {
        success: true,
        operationId,
        message: 'Timelock operation scheduled successfully'
      };
    } catch (error) {
      this.logger.error('Failed to schedule timelock operation:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to schedule timelock operation',
          error: (error as Error).message
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Execute a timelock operation (with delay validation)
   */
  @Post('execute/:operationId')
  @UseGuards(TimelockExecutionGuard)
  @TimelockProtected('operationId')
  async executeOperation(@Param('operationId') operationId: string) {
    try {
      this.logger.log(`Executing timelock operation: ${operationId}`);
      
      await this.securityService.executeTimelockOperation(operationId);
      
      return {
        success: true,
        message: 'Timelock operation executed successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to execute timelock operation ${operationId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to execute timelock operation',
          error: (error as Error).message
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get timelock operation status
   */
  @Get('status/:operationId')
  async getOperationStatus(@Param('operationId') operationId: string): Promise<{
    success: boolean;
    operation?: TimelockOperationWithDetails;
    message?: string;
  }> {
    try {
      const operation = await this.securityService.getTimelockStatus(operationId);
      
      if (!operation) {
        throw new HttpException(
          {
            success: false,
            message: 'Timelock operation not found'
          },
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        operation
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to get timelock status for ${operationId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get timelock operation status',
          error: (error as Error).message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Check if operation can be executed
   */
  @Get('can-execute/:operationId')
  async checkExecutionAvailability(@Param('operationId') operationId: string) {
    try {
      const availability = await this.securityService.checkExecutionAvailability(operationId);
      
      return {
        success: true,
        ...availability
      };
    } catch (error) {
      this.logger.error(`Failed to check execution availability for ${operationId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to check execution availability',
          error: (error as Error).message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * List all pending timelock operations
   */
  @Get('pending')
  async listPendingOperations() {
    try {
      const operations = await this.securityService.timelockManager.listPendingOperations();
      
      return {
        success: true,
        operations,
        count: operations.length
      };
    } catch (error) {
      this.logger.error('Failed to list pending operations:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to list pending operations',
          error: (error as Error).message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * List all operations ready for execution
   */
  @Get('ready')
  async listReadyOperations() {
    try {
      const operations = await this.securityService.timelockManager.listReadyOperations();
      
      return {
        success: true,
        operations,
        count: operations.length
      };
    } catch (error) {
      this.logger.error('Failed to list ready operations:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to list ready operations',
          error: (error as Error).message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Cancel a pending timelock operation
   */
  @Delete('cancel/:operationId')
  async cancelOperation(@Param('operationId') operationId: string) {
    try {
      this.logger.log(`Cancelling timelock operation: ${operationId}`);
      
      await this.securityService.timelockManager.cancelOperation(operationId);
      
      return {
        success: true,
        message: 'Timelock operation cancelled successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to cancel timelock operation ${operationId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to cancel timelock operation',
          error: (error as Error).message
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get overall security status including timelock operations
   */
  @Get('security-status')
  async getSecurityStatus() {
    try {
      const status = await this.securityService.getSecurityStatus();
      
      return {
        success: true,
        status
      };
    } catch (error) {
      this.logger.error('Failed to get security status:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get security status',
          error: (error as Error).message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Validate timelock execution (utility endpoint)
   */
  @Post('validate-execution')
  async validateExecution(@Body() dto: { operationId: string }) {
    try {
      const enforcement = await this.securityService.validateTimelockExecution(dto.operationId);
      
      return {
        success: true,
        enforcement
      };
    } catch (error) {
      this.logger.error(`Failed to validate timelock execution for ${dto.operationId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to validate timelock execution',
          error: (error as Error).message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}