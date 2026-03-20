/**
 * Agent Service
 * 
 * Service for fetching agent data including agent list, details, executions,
 * and statistics.
 * 
 * Features:
 * - Fetch paginated list of agents with filtering
 * - Get detailed information about specific agents
 * - Retrieve agent execution history
 * - Access agent performance statistics
 * - Support filtering by specialty and reputation
 * 
 * @example
 * ```typescript
 * const agentService = getAgentService();
 * 
 * // Fetch agents with filters
 * const agents = await agentService.getAgents({
 *   specialty: 'yield',
 *   minReputation: 90,
 *   limit: 20,
 *   offset: 0
 * });
 * 
 * // Get agent details
 * const details = await agentService.getAgentDetails('0xAgent1...');
 * 
 * // Get agent statistics
 * const stats = await agentService.getAgentStats('0xAgent1...');
 * ```
 */

import { getApiClient } from './api-client.service';
import { API_ENDPOINTS, buildUrl } from '@/lib/api-endpoints';
import type {
  AgentsListRequest,
  AgentsListResponse,
  AgentDetailsResponse,
  AgentExecutionsRequest,
  AgentExecutionsResponse,
  AgentStatsResponse,
} from '@/types/api.types';

export class AgentService {
  /**
   * Fetch list of agents with pagination and filtering
   * 
   * Retrieves a paginated list of AI agents with optional filtering by
   * specialty and minimum reputation score. Results are sorted by reputation
   * by default.
   * 
   * @param options - Optional filtering and pagination parameters
   * @param options.limit - Maximum number of agents to return (default: 20)
   * @param options.offset - Number of agents to skip for pagination (default: 0)
   * @param options.specialty - Filter by agent specialty (e.g., 'yield', 'liquidity', 'arbitrage')
   * @param options.minReputation - Filter by minimum reputation score (0-100)
   * @returns Promise with paginated list of agents and total count
   * 
   * @example
   * ```typescript
   * // Get first page of yield specialists with high reputation
   * const result = await agentService.getAgents({
   *   specialty: 'yield',
   *   minReputation: 90,
   *   limit: 20,
   *   offset: 0
   * });
   * 
   * console.log(`Found ${result.total} agents`);
   * result.agents.forEach(agent => {
   *   console.log(`${agent.name}: ${agent.reputation} reputation`);
   * });
   * ```
   */
  async getAgents(options?: AgentsListRequest): Promise<AgentsListResponse> {
    const apiClient = getApiClient();
    const url = buildUrl(API_ENDPOINTS.AGENTS_LIST, options);
    const response = await apiClient.get<AgentsListResponse>(url);
    return response.data;
  }

  /**
   * Fetch detailed information about a specific agent
   * 
   * Retrieves comprehensive details about an agent including reputation,
   * execution history, specialties, stake amount, and activity timestamps.
   * 
   * @param address - The agent's Ethereum address
   * @returns Promise with detailed agent information
   * @throws Error if agent not found or network error occurs
   * 
   * @example
   * ```typescript
   * const details = await agentService.getAgentDetails('0xAgent1...');
   * 
   * console.log(`Agent: ${details.name}`);
   * console.log(`Reputation: ${details.reputation}`);
   * console.log(`Success Rate: ${details.successRate}%`);
   * console.log(`Total Executions: ${details.totalExecutions}`);
   * ```
   */
  async getAgentDetails(address: string): Promise<AgentDetailsResponse> {
    const apiClient = getApiClient();
    const response = await apiClient.get<AgentDetailsResponse>(
      API_ENDPOINTS.AGENT_DETAILS(address)
    );
    return response.data;
  }

  /**
   * Fetch execution history for a specific agent
   * 
   * Retrieves a paginated list of past executions performed by the agent,
   * including status, gas usage, execution time, and timestamps.
   * 
   * @param address - The agent's Ethereum address
   * @param options - Optional pagination parameters
   * @param options.limit - Maximum number of executions to return (default: 10)
   * @param options.offset - Number of executions to skip for pagination (default: 0)
   * @returns Promise with paginated list of executions and total count
   * 
   * @example
   * ```typescript
   * // Get recent executions
   * const result = await agentService.getAgentExecutions('0xAgent1...', {
   *   limit: 10,
   *   offset: 0
   * });
   * 
   * result.executions.forEach(execution => {
   *   console.log(`Intent ${execution.intentId}: ${execution.status}`);
   *   console.log(`Gas Used: ${execution.gasUsed}`);
   *   console.log(`Execution Time: ${execution.executionTime}ms`);
   * });
   * ```
   */
  async getAgentExecutions(
    address: string,
    options?: AgentExecutionsRequest
  ): Promise<AgentExecutionsResponse> {
    const apiClient = getApiClient();
    const url = buildUrl(API_ENDPOINTS.AGENT_EXECUTIONS(address), options);
    const response = await apiClient.get<AgentExecutionsResponse>(url);
    return response.data;
  }

  /**
   * Fetch statistics for a specific agent
   * 
   * Retrieves comprehensive performance statistics including total executions,
   * success rate, average execution time, gas usage, fees earned, and reputation.
   * 
   * @param address - The agent's Ethereum address
   * @returns Promise with agent performance statistics
   * 
   * @example
   * ```typescript
   * const stats = await agentService.getAgentStats('0xAgent1...');
   * 
   * console.log(`Total Executions: ${stats.totalExecutions}`);
   * console.log(`Success Rate: ${stats.successRate}%`);
   * console.log(`Average Execution Time: ${stats.averageExecutionTime}ms`);
   * console.log(`Total Fees Earned: ${stats.totalFeesEarned} ETH`);
   * console.log(`Reputation: ${stats.reputation}`);
   * ```
   */
  async getAgentStats(address: string): Promise<AgentStatsResponse> {
    const apiClient = getApiClient();
    const response = await apiClient.get<AgentStatsResponse>(
      API_ENDPOINTS.AGENT_STATS(address)
    );
    return response.data;
  }
}

// Singleton instance
let agentServiceInstance: AgentService | null = null;

/**
 * Get the singleton AgentService instance
 * 
 * Returns the global AgentService instance, creating it if it doesn't exist.
 * This ensures only one instance of the service is used throughout the application.
 * 
 * @returns The singleton AgentService instance
 * 
 * @example
 * ```typescript
 * // Get the service instance
 * const agentService = getAgentService();
 * 
 * // Use the service
 * const agents = await agentService.getAgents();
 * ```
 */
export function getAgentService(): AgentService {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService();
  }
  return agentServiceInstance;
}
