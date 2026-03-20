"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Portfolio } from "@/types";
import { getPortfolioService } from "@/services/portfolio.service";

interface UsePortfolioOptions {
  address: string | null;
  enabled?: boolean;
}

const STALE_TIME = 30000; // 30 seconds - data is fresh
const STALE_DURATION = 60000; // 60 seconds - mark as stale
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds - auto-refresh

export function usePortfolio({ address, enabled = true }: UsePortfolioOptions) {
  const portfolioService = getPortfolioService();
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [isStale, setIsStale] = useState(false);

  const query = useQuery({
    queryKey: ["portfolio", address],
    queryFn: async (): Promise<Portfolio> => {
      if (!address) {
        throw new Error("Address is required");
      }

      const data = await portfolioService.getPortfolio(address);
      setLastFetchTime(Date.now());
      
      return {
        totalValueUsd: data.totalValueUsd,
        balances: data.balances,
        yieldPositions: data.yieldPositions,
        lastUpdated: Date.now(),
        isStale: false,
      };
    },
    enabled: enabled && !!address,
    refetchInterval: AUTO_REFRESH_INTERVAL,
    refetchIntervalInBackground: false, // Only refresh when page is visible
    refetchOnWindowFocus: true,
    staleTime: STALE_TIME,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Calculate staleness based on last fetch time
  useEffect(() => {
    if (!query.data || !lastFetchTime) {
      setIsStale(false);
      return;
    }

    const checkStaleness = () => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime;
      setIsStale(timeSinceLastFetch > STALE_DURATION);
    };

    // Check immediately
    checkStaleness();

    // Check every 5 seconds
    const interval = setInterval(checkStaleness, 5000);

    return () => clearInterval(interval);
  }, [query.data, lastFetchTime]);

  // Transform portfolio data to include staleness
  const portfolio = useMemo<Portfolio | undefined>(() => {
    if (!query.data) return undefined;
    
    return {
      ...query.data,
      lastUpdated: lastFetchTime,
      isStale,
    };
  }, [query.data, lastFetchTime, isStale]);

  return {
    ...query,
    data: portfolio,
    isStale,
  };
}
