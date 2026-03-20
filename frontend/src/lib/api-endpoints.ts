/**
 * API Endpoints
 * 
 * Centralized API endpoint definitions
 * 
 * Note: These paths are relative to the base URL configured in init-api-client.ts
 * Base URL is '/api' (Next.js proxy) or full URL in production
 */

export const API_ENDPOINTS = {
  // Health & System
  HEALTH: '/health',
  HEALTH_CACHE: '/health/cache',
  HEALTH_REDIS: '/health/redis',

  // Authentication
  AUTH_NONCE: '/auth/nonce',
  AUTH_VERIFY: '/auth/verify-signature',

  // Chat
  CHAT_MESSAGE: '/chat/message',
  CHAT_MEMORY: (userId: string) => `/chat/memory/${userId}`,
  CHAT_MEMORY_DELETE: (memoryId: string) => `/chat/memory/${memoryId}`,
  CHAT_CACHE_CLEAR: (userId: string) => `/chat/cache/${userId}`,

  // Intent
  INTENT_CREATE: '/intent/create',
  INTENT_APPROVE: '/intent/approve',
  INTENT_EXECUTE: '/intent/execute',
  INTENT_DETAILS: (intentId: number) => `/intent/${intentId}`,
  INTENT_USER: (address: string) => `/intent/user/${address}`,

  // Execution
  EXECUTION_STATUS: (intentId: number) => `/execution/${intentId}`,

  // Portfolio
  PORTFOLIO: (address: string) => `/portfolio/${address}`,
  PORTFOLIO_BALANCES: (address: string) => `/portfolio/${address}/balances`,
  PORTFOLIO_POSITIONS: (address: string) => `/portfolio/${address}/positions`,
  PORTFOLIO_HISTORY: (address: string) => `/portfolio/${address}/history`,

  // Agents
  AGENTS_LIST: '/agents',
  AGENT_DETAILS: (address: string) => `/agents/${address}`,
  AGENT_EXECUTIONS: (address: string) => `/agents/${address}/executions`,
  AGENT_STATS: (address: string) => `/agents/${address}/stats`,

  // Bot Dashboard
  BOT_DASHBOARD: '/agents/bot/dashboard',
  BOT_HEALTH: '/agents/bot/health',
  BOT_STATUS: '/agents/bot/production/status',
  BOT_START: '/agents/bot/production/start',
  BOT_STOP: '/agents/bot/production/stop',

  // Memory
  MEMORY_GET: (userId: string) => `/memory/${userId}`,
} as const;

/**
 * Build query string from parameters
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Build URL with query parameters
 */
export function buildUrl(endpoint: string, params?: Record<string, any>): string {
  if (!params) return endpoint;
  return `${endpoint}${buildQueryString(params)}`;
}
