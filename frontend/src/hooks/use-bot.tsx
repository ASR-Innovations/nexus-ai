'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
export interface BotStatus {
  isRunning: boolean;
  isMonitoring: boolean;
  config: BotConfig | null;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastCheck: string;
  };
}

export interface BotConfig {
  address: string;
  name: string;
  specialties: string[];
  riskTolerance: 'low' | 'medium' | 'high';
  maxActiveIntents: number;
  autoExecute: boolean;
}

export interface BotMetrics {
  totalExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  totalValueProcessed: string;
  activeIntents: number;
}

export interface DashboardData {
  overview: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalValueProcessed: string;
    avgExecutionTime: number;
    activeIntents: number;
  };
  recentActivity: Array<{
    intentId: number;
    type: string;
    status: string;
    timestamp: number;
    value: string;
  }>;
  protocolDistribution: Array<{
    protocol: string;
    count: number;
    value: string;
  }>;
  performanceChart: Array<{
    timestamp: number;
    executions: number;
    successRate: number;
  }>;
}

// API Functions
const botApi = {
  getStatus: async (): Promise<BotStatus> => {
    const res = await fetch(`${API_BASE}/api/agents/bot/status`);
    if (!res.ok) throw new Error('Failed to fetch bot status');
    return res.json();
  },

  getDashboard: async (): Promise<DashboardData> => {
    const res = await fetch(`${API_BASE}/api/agents/bot/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return res.json();
  },

  getMetrics: async (): Promise<BotMetrics> => {
    const res = await fetch(`${API_BASE}/api/agents/bot/metrics`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  },

  startMonitoring: async (): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/api/agents/bot/start-monitoring`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to start monitoring');
    return res.json();
  },

  stopMonitoring: async (): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/api/agents/bot/stop-monitoring`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to stop monitoring');
    return res.json();
  },
};

// Hooks
export function useBotStatus() {
  return useQuery({
    queryKey: ['bot', 'status'],
    queryFn: botApi.getStatus,
    refetchInterval: 5000,
  });
}

export function useBotDashboard() {
  return useQuery({
    queryKey: ['bot', 'dashboard'],
    queryFn: botApi.getDashboard,
    refetchInterval: 10000,
  });
}

export function useBotMetrics() {
  return useQuery({
    queryKey: ['bot', 'metrics'],
    queryFn: botApi.getMetrics,
    refetchInterval: 5000,
  });
}

export function useStartMonitoring() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: botApi.startMonitoring,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', 'status'] });
      toast.success('Bot monitoring started!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to start monitoring: ${error.message}`);
    },
  });
}

export function useStopMonitoring() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: botApi.stopMonitoring,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', 'status'] });
      toast.info('Bot monitoring stopped');
    },
    onError: (error: Error) => {
      toast.error(`Failed to stop monitoring: ${error.message}`);
    },
  });
}
