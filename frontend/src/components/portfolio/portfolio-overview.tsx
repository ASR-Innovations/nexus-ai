'use client';

import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortfolio } from '@/hooks/use-portfolio';
import { cn } from '@/lib/utils';

interface PortfolioOverviewProps {
  address: string | null;
}

export function PortfolioOverview({ address }: PortfolioOverviewProps) {
  const { data: portfolio, isLoading, isRefetching, isStale, refetch } = usePortfolio({
    address,
    enabled: !!address,
  });

  // Calculate 24h change (mock data for now - would come from backend)
  const change24h = {
    percentage: 2.45,
    absolute: 1234.56,
  };

  const isPositive = change24h.percentage >= 0;

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton variant="text" height={16} width="40%" />
              <Skeleton variant="text" height={48} width="60%" />
            </div>
            <Skeleton variant="circular" width={40} height={40} />
          </div>
          <div className="space-y-2">
            <Skeleton variant="text" height={20} width="30%" />
            <Skeleton variant="text" height={16} width="50%" />
          </div>
        </div>
      </Card>
    );
  }

  if (!portfolio) {
    return null;
  }

  return (
    <Card className="relative overflow-hidden">
      {/* Stale indicator */}
      {isStale && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-light-warning/10 dark:bg-dark-warning/10 border border-light-warning/20 dark:border-dark-warning/20"
        >
          <span className="text-label-sm text-light-warning dark:text-dark-warning">
            Refreshing...
          </span>
        </motion.div>
      )}

      <div className="space-y-6">
        {/* Header with refresh button */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-label-md text-light-textSecondary dark:text-dark-textSecondary">
              Total Portfolio Value
            </h3>
            <motion.div
              key={portfolio.totalValueUsd}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-[56px] leading-[64px] font-bold tracking-tight text-light-textPrimary dark:text-dark-textPrimary"
            >
              ${portfolio.totalValueUsd.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </motion.div>
          </div>

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="md"
            onClick={handleRefresh}
            disabled={isRefetching}
            className="shrink-0"
          >
            <motion.div
              animate={{ rotate: isRefetching ? 360 : 0 }}
              transition={{
                duration: 1,
                repeat: isRefetching ? Infinity : 0,
                ease: 'linear',
              }}
            >
              <RefreshCw className="w-5 h-5" />
            </motion.div>
          </Button>
        </div>

        {/* 24h change */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3"
        >
          <div
            className={cn(
              'px-3 py-1.5 rounded-lg',
              isPositive
                ? 'bg-light-positive/10 dark:bg-dark-positive/10'
                : 'bg-light-negative/10 dark:bg-dark-negative/10'
            )}
          >
            <span
              className={cn(
                'text-label-lg font-semibold',
                isPositive
                  ? 'text-light-positive dark:text-dark-positive'
                  : 'text-light-negative dark:text-dark-negative'
              )}
            >
              {isPositive ? '+' : ''}
              {change24h.percentage.toFixed(2)}%
            </span>
          </div>
          <div className="text-body-md text-light-textSecondary dark:text-dark-textSecondary">
            <span
              className={cn(
                'font-medium',
                isPositive
                  ? 'text-light-positive dark:text-dark-positive'
                  : 'text-light-negative dark:text-dark-negative'
              )}
            >
              {isPositive ? '+' : ''}${change24h.absolute.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {' '}
            <span className="text-light-textTertiary dark:text-dark-textTertiary">
              24h
            </span>
          </div>
        </motion.div>

        {/* Last updated timestamp */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-label-sm text-light-textTertiary dark:text-dark-textTertiary"
        >
          Last updated: {new Date(portfolio.lastUpdated).toLocaleTimeString()}
        </motion.div>
      </div>
    </Card>
  );
}
