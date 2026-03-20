/**
 * Portfolio Service
 * 
 * Service for fetching portfolio data including balances, yield positions,
 * and transaction history.
 * 
 * Example implementation showing how to use the API client.
 */

import { getApiClient } from './api-client.service';
import { API_ENDPOINTS, buildUrl } from '@/lib/api-endpoints';
import {
  PortfolioResponse,
  BalancesResponse,
  YieldPositionsResponse,
  TransactionHistoryResponse,
  TransactionHistoryRequest,
} from '@/types/api.types';

export class PortfolioService {
  /**
   * Fetch complete portfolio overview
   */
  async getPortfolio(address: string): Promise<PortfolioResponse> {
    const apiClient = getApiClient();
    const response = await apiClient.get<PortfolioResponse>(
      API_ENDPOINTS.PORTFOLIO(address)
    );
    
    // Transform API response to include proper structure
    const data = response.data;
    return {
      totalValueUsd: data.totalValueUsd || 0,
      balances: data.balances || [],
      yieldPositions: data.yieldPositions || [],
      lastUpdated: data.lastUpdated || Date.now(),
      isStale: data.isStale || false,
    };
  }

  /**
   * Fetch detailed balances
   */
  async getBalances(address: string): Promise<BalancesResponse> {
    const apiClient = getApiClient();
    const response = await apiClient.get<BalancesResponse>(
      API_ENDPOINTS.PORTFOLIO_BALANCES(address)
    );
    return response.data;
  }

  /**
   * Fetch yield positions
   */
  async getYieldPositions(address: string): Promise<YieldPositionsResponse> {
    const apiClient = getApiClient();
    const response = await apiClient.get<YieldPositionsResponse>(
      API_ENDPOINTS.PORTFOLIO_POSITIONS(address)
    );
    return response.data;
  }

  /**
   * Fetch transaction history with pagination
   */
  async getTransactionHistory(
    address: string,
    options?: TransactionHistoryRequest
  ): Promise<TransactionHistoryResponse> {
    const apiClient = getApiClient();
    const url = buildUrl(API_ENDPOINTS.PORTFOLIO_HISTORY(address), options);
    const response = await apiClient.get<TransactionHistoryResponse>(url);
    return response.data;
  }

  /**
   * Refresh portfolio data (force fetch)
   */
  async refreshPortfolio(address: string): Promise<PortfolioResponse> {
    const apiClient = getApiClient();
    const response = await apiClient.get<PortfolioResponse>(
      API_ENDPOINTS.PORTFOLIO(address),
      { skipDeduplication: true } // Force fresh request
    );
    return response.data;
  }
}

// Singleton instance
let portfolioServiceInstance: PortfolioService | null = null;

export function getPortfolioService(): PortfolioService {
  if (!portfolioServiceInstance) {
    portfolioServiceInstance = new PortfolioService();
  }
  return portfolioServiceInstance;
}
