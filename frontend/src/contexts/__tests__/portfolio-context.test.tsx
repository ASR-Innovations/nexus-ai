/**
 * Portfolio Context Tests
 * 
 * Tests for TanStack Query integration with caching and auto-refresh
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePortfolioData } from '../portfolio-context';
import { getPortfolioService } from '@/services/portfolio.service';

// Mock the portfolio service
jest.mock('@/services/portfolio.service');

const mockGetPortfolioService = getPortfolioService as jest.MockedFunction<typeof getPortfolioService>;

describe('usePortfolioData', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 30000,
        },
      },
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should fetch portfolio data when address is provided', async () => {
    const mockPortfolio = {
      totalValueUsd: 1000,
      balances: [],
      yieldPositions: [],
      lastUpdated: Date.now(),
      isStale: false,
    };

    const mockService = {
      getPortfolio: jest.fn().mockResolvedValue(mockPortfolio),
    };

    mockGetPortfolioService.mockReturnValue(mockService as any);

    const { result } = renderHook(() => usePortfolioData('0x123'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.portfolio).toMatchObject({
      totalValueUsd: 1000,
      balances: [],
      yieldPositions: [],
    });
    expect(mockService.getPortfolio).toHaveBeenCalledWith('0x123');
  });

  it('should not fetch when address is null', () => {
    const mockService = {
      getPortfolio: jest.fn(),
    };

    mockGetPortfolioService.mockReturnValue(mockService as any);

    const { result } = renderHook(() => usePortfolioData(null), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.portfolio).toBe(null);
    expect(mockService.getPortfolio).not.toHaveBeenCalled();
  });

  it('should cache portfolio data for 30 seconds', async () => {
    const mockPortfolio = {
      totalValueUsd: 1000,
      balances: [],
      yieldPositions: [],
      lastUpdated: Date.now(),
      isStale: false,
    };

    const mockService = {
      getPortfolio: jest.fn().mockResolvedValue(mockPortfolio),
    };

    mockGetPortfolioService.mockReturnValue(mockService as any);

    // First render
    const { result: result1 } = renderHook(() => usePortfolioData('0x123'), { wrapper });

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });

    expect(mockService.getPortfolio).toHaveBeenCalledTimes(1);

    // Second render with same address should use cache
    const { result: result2 } = renderHook(() => usePortfolioData('0x123'), { wrapper });

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    // Should still be called only once due to caching
    expect(mockService.getPortfolio).toHaveBeenCalledTimes(1);
  });

  it('should initialize with isStale as false', async () => {
    const mockPortfolio = {
      totalValueUsd: 1000,
      balances: [],
      yieldPositions: [],
      lastUpdated: Date.now(),
      isStale: false,
    };

    const mockService = {
      getPortfolio: jest.fn().mockResolvedValue(mockPortfolio),
    };

    mockGetPortfolioService.mockReturnValue(mockService as any);

    const { result } = renderHook(() => usePortfolioData('0x123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initially, data should not be stale
    expect(result.current.isStale).toBe(false);
    expect(result.current.portfolio?.isStale).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const mockService = {
      getPortfolio: jest.fn().mockRejectedValue(new Error('Network error')),
    };

    mockGetPortfolioService.mockReturnValue(mockService as any);

    const { result } = renderHook(() => usePortfolioData('0x123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.portfolio).toBe(null);
  });

  it('should support manual refetch', async () => {
    const mockPortfolio = {
      totalValueUsd: 1000,
      balances: [],
      yieldPositions: [],
      lastUpdated: Date.now(),
      isStale: false,
    };

    const mockService = {
      getPortfolio: jest.fn().mockResolvedValue(mockPortfolio),
    };

    mockGetPortfolioService.mockReturnValue(mockService as any);

    const { result } = renderHook(() => usePortfolioData('0x123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockService.getPortfolio).toHaveBeenCalledTimes(1);

    // Manual refetch
    result.current.refetch();

    await waitFor(() => {
      expect(mockService.getPortfolio).toHaveBeenCalledTimes(2);
    });
  });
});
