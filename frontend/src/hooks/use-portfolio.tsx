"use client";

import { useQuery } from "@tanstack/react-query";
import { Portfolio } from "@/types";

interface UsePortfolioOptions {
  address: string | null;
  enabled?: boolean;
}

export function usePortfolio({ address, enabled = true }: UsePortfolioOptions) {
  return useQuery({
    queryKey: ["portfolio", address],
    queryFn: async (): Promise<Portfolio> => {
      if (!address) {
        throw new Error("Address is required");
      }

      const response = await fetch(`/api/portfolio/${address}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!address,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 25000, // Consider data stale after 25 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}