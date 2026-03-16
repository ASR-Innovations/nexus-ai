import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService, CircuitBreakerStats } from './circuit-breaker.service';

export interface ApiHealthStatus {
  serviceName: string;
  healthy: boolean;
  circuitState: string;
  lastCheck: number;
  responseTime?: number;
  errorMessage?: string;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  apis: ApiHealthStatus[];
  timestamp: number;
}

@Injectable()
export class ApiHealthService {
  private readonly logger = new Logger(ApiHealthService.name);
  private healthCache = new Map<string, ApiHealthStatus>();

  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  /**
   * Check health of a specific API endpoint
   */
  async checkApiHealth(
    serviceName: string,
    healthCheckFn: () => Promise<void>
  ): Promise<ApiHealthStatus> {
    const startTime = Date.now();
    
    try {
      await healthCheckFn();
      
      const status: ApiHealthStatus = {
        serviceName,
        healthy: true,
        circuitState: this.getCircuitState(serviceName),
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime,
      };
      
      this.healthCache.set(serviceName, status);
      return status;
    } catch (error) {
      const status: ApiHealthStatus = {
        serviceName,
        healthy: false,
        circuitState: this.getCircuitState(serviceName),
        lastCheck: Date.now(),
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
      
      this.healthCache.set(serviceName, status);
      return status;
    }
  }

  /**
   * Get cached health status for a service
   */
  getCachedHealth(serviceName: string): ApiHealthStatus | null {
    return this.healthCache.get(serviceName) || null;
  }

  /**
   * Get system-wide health report
   */
  getSystemHealth(): SystemHealthReport {
    const apis: ApiHealthStatus[] = [];
    let healthyCount = 0;
    let totalCount = 0;

    // Get all circuit breaker stats
    const allStats = this.circuitBreakerService.getAllStats();
    
    for (const [serviceName, stats] of Object.entries(allStats)) {
      const cached = this.healthCache.get(serviceName);
      
      const status: ApiHealthStatus = {
        serviceName,
        healthy: stats.state === 'CLOSED',
        circuitState: stats.state,
        lastCheck: stats.lastFailureTime || Date.now(),
      };
      
      if (cached) {
        status.responseTime = cached.responseTime;
        status.errorMessage = cached.errorMessage;
      }
      
      apis.push(status);
      totalCount++;
      if (status.healthy) healthyCount++;
    }

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (totalCount === 0) {
      overall = 'healthy'; // No services registered yet
    } else if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      apis,
      timestamp: Date.now(),
    };
  }

  /**
   * Get circuit state for a service
   */
  private getCircuitState(serviceName: string): string {
    const stats = this.circuitBreakerService.getStats(serviceName);
    return stats?.state || 'UNKNOWN';
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
    this.logger.log('Health cache cleared');
  }

  /**
   * Get detailed stats for all services
   */
  getDetailedStats(): Record<string, CircuitBreakerStats> {
    return this.circuitBreakerService.getAllStats();
  }
}
