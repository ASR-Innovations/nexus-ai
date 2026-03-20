"use client";

import { useWallet } from "@/hooks/use-wallet";
import { usePortfolio } from "@/hooks/use-portfolio";
import { BalanceCard } from "@/components/balance-card";
import { YieldPosition } from "@/components/yield-position";
import { PerformanceChart } from "@/components/portfolio/performance-chart";
import { RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortfolioView() {
  const { address, isConnected, connect } = useWallet();
  const { data: portfolio, isLoading, error, refetch, isRefetching } = usePortfolio({ 
    address,
    enabled: isConnected 
  });

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Portfolio</h1>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to view your cross-chain portfolio
          </p>
          <button
            onClick={connect}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const formatValue = (value: number) => {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatLastUpdated = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
            <p className="text-muted-foreground">
              Your cross-chain assets and yield positions
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors",
              isRefetching && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Failed to load portfolio</span>
          </div>
          <p className="text-sm text-destructive/80 mt-1">
            {error.message}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Loading skeletons */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-48 mb-4"></div>
              <div className="h-8 bg-muted rounded w-32 mb-2"></div>
              <div className="h-4 bg-muted rounded w-64"></div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-24 mb-4"></div>
              <div className="space-y-4">
                <div className="h-20 bg-muted rounded"></div>
                <div className="h-20 bg-muted rounded"></div>
              </div>
            </div>
          </div>
          <div>
            <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-32 mb-4"></div>
              <div className="h-20 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Total Value Card */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-2">Total Portfolio Value</h2>
              <div className="text-3xl font-bold text-primary">
                {formatValue(portfolio?.totalValueUsd || 0)}
              </div>
              <div className="text-sm text-muted-foreground">
                Across all chains • Last updated: {portfolio?.lastUpdated ? formatLastUpdated(portfolio.lastUpdated) : "Never"}
                {portfolio?.isStale && (
                  <span className="ml-2 text-amber-600">• Data may be stale</span>
                )}
              </div>
            </div>
          </div>

          {/* Portfolio Chart */}
          <div className="lg:col-span-3">
            <PerformanceChart />
          </div>

          {/* Balances */}
          <div className="lg:col-span-2">
            <BalanceCard balances={portfolio?.balances || []} />
          </div>

          {/* Yield Positions */}
          <div>
            <YieldPosition positions={portfolio?.yieldPositions || []} />
          </div>
        </div>
      )}
    </div>
  );
}