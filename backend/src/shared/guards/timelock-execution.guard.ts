/**
 * Timelock Execution Guard
 * 
 * NestJS guard that enforces timelock delays before allowing execution
 * of critical operations. Validates that the required delay period has elapsed.
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityService } from '../services/security.service';

export const TIMELOCK_OPERATION_KEY = 'timelockOperation';

/**
 * Decorator to mark endpoints that require timelock validation
 */
export const RequireTimelockExecution = (operationIdParam: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflector.createDecorator<string>()(operationIdParam)(target, propertyKey, descriptor);
  };
};

@Injectable()
export class TimelockExecutionGuard implements CanActivate {
  private readonly logger = new Logger(TimelockExecutionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly securityService: SecurityService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the timelock operation ID parameter name from metadata
    const operationIdParam = this.reflector.get<string>(
      TIMELOCK_OPERATION_KEY,
      context.getHandler()
    );

    // If no timelock requirement is set, allow execution
    if (!operationIdParam) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const operationId = request.params[operationIdParam] || request.body[operationIdParam];

    if (!operationId) {
      this.logger.error(`Timelock operation ID not found in parameter: ${operationIdParam}`);
      throw new ForbiddenException('Timelock operation ID is required');
    }

    try {
      // Validate timelock execution
      const enforcement = await this.securityService.validateTimelockExecution(operationId);
      
      if (!enforcement.canExecute) {
        this.logger.warn(`Timelock execution denied for operation ${operationId}: ${enforcement.reason}`);
        
        let errorMessage = `Timelock execution not allowed: ${enforcement.reason}`;
        
        if (enforcement.timeRemaining) {
          const hoursRemaining = Math.ceil(enforcement.timeRemaining / (1000 * 60 * 60));
          errorMessage += `. Time remaining: ${hoursRemaining} hours`;
        }
        
        throw new ForbiddenException(errorMessage);
      }

      this.logger.log(`Timelock execution validated for operation ${operationId}`);
      return true;

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      this.logger.error(`Timelock validation failed for operation ${operationId}:`, error);
      throw new ForbiddenException('Timelock validation failed');
    }
  }
}

/**
 * Decorator factory for timelock-protected endpoints
 */
export function TimelockProtected(operationIdParam: string = 'operationId') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Set metadata for the guard
    Reflector.createDecorator<string>()(operationIdParam)(target, propertyKey, descriptor);
    
    // Apply the guard (this would typically be done at the controller level)
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // The actual guard logic is handled by the TimelockExecutionGuard
      // This decorator just marks the method for guard processing
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}