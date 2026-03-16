import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;    // Number of failures before opening circuit
  successThreshold?: number;    // Number of successes to close circuit from half-open
  timeout?: number;             // Time in ms before attempting to close circuit
  monitoringPeriod?: number;    // Time window for counting failures
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  
  // Circuit state per service
  private circuits = new Map<string, {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number;
    nextAttemptTime: number;
    options: Required<CircuitBreakerOptions>;
  }>();

  // Default options
  private readonly DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    monitoringPeriod: 60000, // 1 minute
  };

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
    options?: CircuitBreakerOptions
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(serviceName, options);

    // Check circuit state
    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() < circuit.nextAttemptTime) {
        const error = new Error(`Circuit breaker is OPEN for ${serviceName}`);
        error.name = 'CircuitBreakerError';
        throw error;
      }
      
      // Transition to HALF_OPEN to test service
      this.transitionTo(serviceName, CircuitState.HALF_OPEN);
      this.logger.log(`Circuit breaker transitioning to HALF_OPEN for ${serviceName}`);
    }

    try {
      const result = await fn();
      this.onSuccess(serviceName);
      return result;
    } catch (error) {
      this.onFailure(serviceName);
      throw error;
    }
  }

  /**
   * Execute with fallback - returns fallback value if circuit is open
   */
  async executeWithFallback<T>(
    serviceName: string,
    fn: () => Promise<T>,
    fallback: T,
    options?: CircuitBreakerOptions
  ): Promise<{ value: T; usedFallback: boolean }> {
    try {
      const value = await this.execute(serviceName, fn, options);
      return { value, usedFallback: false };
    } catch (error) {
      if (error instanceof Error && error.name === 'CircuitBreakerError') {
        this.logger.warn(`Using fallback for ${serviceName} - circuit is OPEN`);
        return { value: fallback, usedFallback: true };
      }
      throw error;
    }
  }

  /**
   * Get circuit breaker statistics for a service
   */
  getStats(serviceName: string): CircuitBreakerStats | null {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return null;

    return {
      state: circuit.state,
      failures: circuit.failures,
      successes: circuit.successes,
      lastFailureTime: circuit.lastFailureTime,
      nextAttemptTime: circuit.state === CircuitState.OPEN ? circuit.nextAttemptTime : undefined,
    };
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [serviceName, circuit] of this.circuits.entries()) {
      stats[serviceName] = {
        state: circuit.state,
        failures: circuit.failures,
        successes: circuit.successes,
        lastFailureTime: circuit.lastFailureTime,
        nextAttemptTime: circuit.state === CircuitState.OPEN ? circuit.nextAttemptTime : undefined,
      };
    }
    
    return stats;
  }

  /**
   * Manually reset a circuit breaker
   */
  reset(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastFailureTime = 0;
      circuit.nextAttemptTime = 0;
      this.logger.log(`Circuit breaker manually reset for ${serviceName}`);
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const serviceName of this.circuits.keys()) {
      this.reset(serviceName);
    }
    this.logger.log('All circuit breakers reset');
  }

  /**
   * Get or create circuit for a service
   */
  private getOrCreateCircuit(serviceName: string, options?: CircuitBreakerOptions) {
    let circuit = this.circuits.get(serviceName);
    
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        options: { ...this.DEFAULT_OPTIONS, ...options },
      };
      this.circuits.set(serviceName, circuit);
      this.logger.log(`Created circuit breaker for ${serviceName}`);
    }
    
    return circuit;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return;

    circuit.successes++;

    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.successes >= circuit.options.successThreshold) {
        this.transitionTo(serviceName, CircuitState.CLOSED);
        circuit.failures = 0;
        circuit.successes = 0;
        this.logger.log(`Circuit breaker CLOSED for ${serviceName} after ${circuit.successes} successes`);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return;

    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    circuit.successes = 0; // Reset success counter

    // Check if we should open the circuit
    if (circuit.state === CircuitState.CLOSED || circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.failures >= circuit.options.failureThreshold) {
        this.transitionTo(serviceName, CircuitState.OPEN);
        circuit.nextAttemptTime = Date.now() + circuit.options.timeout;
        this.logger.warn(
          `Circuit breaker OPENED for ${serviceName} after ${circuit.failures} failures. ` +
          `Will retry at ${new Date(circuit.nextAttemptTime).toISOString()}`
        );
      }
    }

    // Clean up old failures outside monitoring period
    if (Date.now() - circuit.lastFailureTime > circuit.options.monitoringPeriod) {
      circuit.failures = 1; // Reset to current failure
    }
  }

  /**
   * Transition circuit to new state
   */
  private transitionTo(serviceName: string, newState: CircuitState): void {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return;

    const oldState = circuit.state;
    circuit.state = newState;
    
    this.logger.debug(`Circuit breaker for ${serviceName}: ${oldState} -> ${newState}`);
  }
}
