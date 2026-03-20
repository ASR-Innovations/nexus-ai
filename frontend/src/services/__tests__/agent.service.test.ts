/**
 * Agent Service Tests
 * 
 * Unit tests for the AgentService class
 */

import { AgentService, getAgentService } from '../agent.service';
import { getApiClient } from '../api-client.service';
import { API_ENDPOINTS } from '@/lib/api-endpoints';
import type {
  AgentsListResponse,
  AgentDetailsResponse,
  AgentExecutionsResponse,
  AgentStatsResponse,
} from '@/types/api.types';

// Mock the API client
jest.mock('../api-client.service');

describe('AgentService', () => {
  let agentService: AgentService;
  let mockApiClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock API client
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    // Mock getApiClient to return our mock
    (getApiClient as jest.Mock).mockReturnValue(mockApiClient);

    // Create new service instance
    agentService = new AgentService();
  });

  describe('getAgents', () => {
    it('should fetch agents list without filters', async () => {
      const mockResponse: AgentsListResponse = {
        agents: [
          {
            address: '0xAgent1',
            name: 'YieldMaximizer',
            reputation: 95,
            totalExecutions: 1234,
            successRate: 98.5,
            specialties: ['yield', 'liquidity'],
            isActive: true,
          },
        ],
        total: 50,
        limit: 20,
        offset: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgents();

      expect(mockApiClient.get).toHaveBeenCalledWith(API_ENDPOINTS.AGENTS_LIST);
      expect(result).toEqual(mockResponse);
    });

    it('should fetch agents list with pagination', async () => {
      const mockResponse: AgentsListResponse = {
        agents: [],
        total: 50,
        limit: 10,
        offset: 20,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgents({
        limit: 10,
        offset: 20,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.AGENTS_LIST}?limit=10&offset=20`
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch agents list with specialty filter', async () => {
      const mockResponse: AgentsListResponse = {
        agents: [
          {
            address: '0xAgent1',
            reputation: 95,
            totalExecutions: 1234,
            successRate: 98.5,
            specialties: ['yield'],
            isActive: true,
          },
        ],
        total: 10,
        limit: 20,
        offset: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgents({
        specialty: 'yield',
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.AGENTS_LIST}?specialty=yield`
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch agents list with minimum reputation filter', async () => {
      const mockResponse: AgentsListResponse = {
        agents: [
          {
            address: '0xAgent1',
            reputation: 95,
            totalExecutions: 1234,
            successRate: 98.5,
            specialties: ['yield'],
            isActive: true,
          },
        ],
        total: 5,
        limit: 20,
        offset: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgents({
        minReputation: 90,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.AGENTS_LIST}?minReputation=90`
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch agents list with multiple filters', async () => {
      const mockResponse: AgentsListResponse = {
        agents: [],
        total: 3,
        limit: 10,
        offset: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgents({
        limit: 10,
        offset: 0,
        specialty: 'yield',
        minReputation: 90,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.AGENTS_LIST}?limit=10&offset=0&specialty=yield&minReputation=90`
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');
      mockApiClient.get.mockRejectedValue(error);

      await expect(agentService.getAgents()).rejects.toThrow('Network error');
    });
  });

  describe('getAgentDetails', () => {
    it('should fetch agent details', async () => {
      const mockResponse: AgentDetailsResponse = {
        address: '0xAgent1',
        name: 'YieldMaximizer',
        reputation: 95,
        totalExecutions: 1234,
        successRate: 98.5,
        specialties: ['yield', 'liquidity'],
        isActive: true,
        stakeAmount: '10000',
        registeredAt: 1710000000,
        lastActiveAt: 1710864364,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgentDetails('0xAgent1');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.AGENT_DETAILS('0xAgent1')
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle agent not found', async () => {
      const error = new Error('Agent not found');
      mockApiClient.get.mockRejectedValue(error);

      await expect(agentService.getAgentDetails('0xInvalid')).rejects.toThrow(
        'Agent not found'
      );
    });
  });

  describe('getAgentExecutions', () => {
    it('should fetch agent executions without pagination', async () => {
      const mockResponse: AgentExecutionsResponse = {
        executions: [
          {
            intentId: 123,
            status: 'completed',
            gasUsed: '750000',
            executionTime: 45000,
            timestamp: 1710864364,
          },
        ],
        count: 10,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgentExecutions('0xAgent1');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.AGENT_EXECUTIONS('0xAgent1')
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch agent executions with pagination', async () => {
      const mockResponse: AgentExecutionsResponse = {
        executions: [],
        count: 100,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgentExecutions('0xAgent1', {
        limit: 10,
        offset: 20,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.AGENT_EXECUTIONS('0xAgent1')}?limit=10&offset=20`
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle empty execution history', async () => {
      const mockResponse: AgentExecutionsResponse = {
        executions: [],
        count: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgentExecutions('0xAgent1');

      expect(result.executions).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('getAgentStats', () => {
    it('should fetch agent statistics', async () => {
      const mockResponse: AgentStatsResponse = {
        totalExecutions: 1234,
        successfulExecutions: 1215,
        failedExecutions: 19,
        successRate: 98.5,
        averageExecutionTime: 42000,
        totalGasUsed: '925000000',
        totalFeesEarned: '125.5',
        reputation: 95,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgentStats('0xAgent1');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.AGENT_STATS('0xAgent1')
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle agent with no executions', async () => {
      const mockResponse: AgentStatsResponse = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        averageExecutionTime: 0,
        totalGasUsed: '0',
        totalFeesEarned: '0',
        reputation: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgentStats('0xNewAgent');

      expect(result.totalExecutions).toBe(0);
      expect(result.successRate).toBe(0);
    });
  });

  describe('getAgentService singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getAgentService();
      const instance2 = getAgentService();

      expect(instance1).toBe(instance2);
    });

    it('should return an AgentService instance', () => {
      const instance = getAgentService();

      expect(instance).toBeInstanceOf(AgentService);
    });
  });

  describe('error handling', () => {
    it('should propagate network errors', async () => {
      const error = new Error('Network error');
      mockApiClient.get.mockRejectedValue(error);

      await expect(agentService.getAgents()).rejects.toThrow('Network error');
    });

    it('should propagate API errors', async () => {
      const error = new Error('Internal server error');
      mockApiClient.get.mockRejectedValue(error);

      await expect(agentService.getAgentDetails('0xAgent1')).rejects.toThrow(
        'Internal server error'
      );
    });

    it('should propagate authentication errors', async () => {
      const error = new Error('Unauthorized');
      mockApiClient.get.mockRejectedValue(error);

      await expect(agentService.getAgentStats('0xAgent1')).rejects.toThrow(
        'Unauthorized'
      );
    });
  });

  describe('data transformation', () => {
    it('should return data as-is from API', async () => {
      const mockResponse: AgentsListResponse = {
        agents: [
          {
            address: '0xAgent1',
            reputation: 95,
            totalExecutions: 1234,
            successRate: 98.5,
            specialties: ['yield'],
            isActive: true,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await agentService.getAgents();

      // Verify no transformation occurred
      expect(result).toEqual(mockResponse);
      expect(result.agents[0].address).toBe('0xAgent1');
      expect(result.agents[0].reputation).toBe(95);
    });
  });

  describe('query parameter handling', () => {
    it('should omit undefined parameters', async () => {
      const mockResponse: AgentsListResponse = {
        agents: [],
        total: 0,
        limit: 20,
        offset: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      await agentService.getAgents({
        limit: 20,
        offset: undefined,
        specialty: undefined,
      });

      // Should only include limit in query string
      expect(mockApiClient.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.AGENTS_LIST}?limit=20`
      );
    });

    it('should handle zero values correctly', async () => {
      const mockResponse: AgentsListResponse = {
        agents: [],
        total: 0,
        limit: 20,
        offset: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      await agentService.getAgents({
        offset: 0,
        minReputation: 0,
      });

      // Should include zero values
      expect(mockApiClient.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.AGENTS_LIST}?offset=0&minReputation=0`
      );
    });
  });
});
