"use client";

import { createContext, useContext, useMemo, ReactNode, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Portfolio } from "@/types";
import { getPortfolioService } from "@/services/portfolio.service";

interface PortfolioContextType {
  portfolio: Portfolio | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  isStale: boolean;
  refetch: () => void;
  clearError: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const STALE_TIME = 30000; // 30 seconds - data is fresh
const STALE_DURATION = 60000; // 60 seconds - mark as stale
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds - auto-refresh

export function PortfolioProvider({ children }: { children: ReactNode }) {
  // This provider is now a simple wrapper
  // The actual data fetching is done via usePortfolioData hook
  return (
    <PortfolioContext.Provider value={{
      portfolio: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
      isStale: false,
      refetch: () => {},
      clearError: () => {},
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}

// Hook to fetch portfolio for a specific address
export function usePortfolioData(address: string | null) {
  const portfolioService = getPortfolioService();
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const {
    data: portfolioData,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['portfolio', address],
    queryFn: async () => {
      if (!address) throw new Error('No address provided');
      const data = await portfolioService.getPortfolio(address);
      setLastFetchTime(Date.now());
      return data;
    },
    enabled: !!address,
    staleTime: STALE_TIME,
    refetchInterval: AUTO_REFRESH_INTERVAL,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  // Calculate staleness
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!portfolioData || !lastFetchTime) {
      setIsStale(false);
      return;
    }

    const checkStaleness = () => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime;
      setIsStale(timeSinceLastFetch > STALE_DURATION);
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, 5000);

    return () => clearInterval(interval);
  }, [portfolioData, lastFetchTime]);

  const portfolio = useMemo<Portfolio | null>(() => {
    if (!portfolioData) return null;
    
    return {
      ...portfolioData,
      lastUpdated: lastFetchTime,
      isStale,
    };
  }, [portfolioData, lastFetchTime, isStale]);

  const error = queryError instanceof Error ? queryError.message : null;

  return {
    portfolio,
    isLoading,
    isRefreshing: isFetching && !isLoading,
    error,
    isStale,
    refetch,
  };
}
