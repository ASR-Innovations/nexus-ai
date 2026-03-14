"use client";

import { useQuery } from "@tanstack/react-query";
import { Agent } from "@/types";

export type AgentSortBy = 'reputation' | 'volume' | 'success_rate';

interface UseAgentsOptions {
  sort?: AgentSortBy;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

interface AgentsResponse {
  agents: Agent[];
  total: number;
}

export function useAgents({ 
  sort = 'reputation', 
  limit = 20, 
  offset = 0, 
  enabled = true 
}: UseAgentsOptions = {}) {
  return useQuery({
    queryKey: ["agents", sort, limit, offset],
    queryFn: async (): Promise<AgentsResponse> => {
      const params = new URLSearchParams({
        sort,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/agents?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }

      return response.json();
    },
    enabled,
    staleTime: 60000, // Consider data stale after 1 minute
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

interface UseAgentDetailOptions {
  address: string | null;
  enabled?: boolean;
}

interface AgentDetailResponse {
  agent: Agent;
  recentExecutions: any[]; // TODO: Define Execution type
}

export function useAgentDetail({ address, enabled = true }: UseAgentDetailOptions) {
  return useQuery({
    queryKey: ["agent", address],
    queryFn: async (): Promise<AgentDetailResponse> => {
      if (!address) {
        throw new Error("Address is required");
      }

      const response = await fetch(`/api/agents/${address}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!address,
    staleTime: 60000, // Consider data stale after 1 minute
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}