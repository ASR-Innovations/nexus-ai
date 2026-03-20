'use client';

import { motion } from 'framer-motion';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { PositionCard } from './position-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useMemo } from 'react';

interface YieldPositionsListProps {
  address: string;
}

// Animation variants for stagger effect
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

// Format USD value
const formatUsd = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (numValue === 0) return '$0.00';
  if (numValue < 0.01) return '< $0.01';
  return numValue.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function YieldPositionsList({ address }: YieldPositionsListProps) {
  const { data: portfolio, isLoading, isError, error, refetch } = usePortfolio({
    address,
    enabled: !!address,
  });

  // Sort positions by value (highest first) and calculate total
  const { sortedPositions, totalValue } = useMemo(() => {
    if (!portfolio?.yieldPositions) {
      return { sortedPositions: [], totalValue: 0 };
    }

    const sorted = [...portfolio.yieldPositions].sort((a, b) => {
      const valueA = parseFloat(a.currentValue ?? a.amount ?? '0');
      const valueB = parseFloat(b.currentValue ?? b.amount ?? '0');
      return valueB - valueA;
    });

    const total = sorted.reduce((sum, position) => {
      return sum + parseFloat(position.currentValue ?? position.amount ?? '0');
    }, 0);

    return { sortedPositions: sorted, totalValue: total };
  }, [portfolio?.yieldPositions]);

  // Loading state - show skeleton cards
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Total value skeleton */}
        <div className="rounded-xl border border-light-glassBorder dark:border-dark-glassBorder bg-light-glassBackground dark:bg-dark-glassBackground backdrop-blur-xl p-6">
          <Skeleton variant="text" height={16} width={120} />
          <Skeleton variant="text" height={40} width={200} className="mt-2" />
        </div>

        {/* Position cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-light-glassBorder dark:border-dark-glassBorder bg-light-glassBackground dark:bg-dark-glassBackground backdrop-blur-xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" height={20} width="60%" />
                  <Skeleton variant="text" height={16} width="40%" />
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton variant="text" height={32} width="80%" />
                <Skeleton variant="text" height={16} width="50%" />
                <Skeleton variant="text" height={40} width="100%" />
                <Skeleton variant="text" height={40} width="100%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state - show error message with retry button
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-light-negative/10 dark:bg-dark-negative/10 p-4 mb-4">
          <AlertCircle className="w-8 h-8 text-light-negative dark:text-dark-negative" />
        </div>
        <h3 className="text-xl font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-2">
          Failed to Load Yield Positions
        </h3>
        <p className="text-light-textSecondary dark:text-dark-textSecondary text-center mb-6 max-w-md">
          {error instanceof Error ? error.message : 'An error occurred while fetching your yield positions.'}
        </p>
        <Button onClick={() => refetch()} variant="primary">
          Retry
        </Button>
      </div>
    );
  }

  // Empty state - no yield positions found
  if (!sortedPositions || sortedPositions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-light-primary/10 dark:bg-dark-primary/10 p-4 mb-4">
          <TrendingUp className="w-8 h-8 text-light-primary dark:text-dark-primary" />
        </div>
        <h3 className="text-xl font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-2">
          Start Earning Yield
        </h3>
        <p className="text-light-textSecondary dark:text-dark-textSecondary text-center mb-6 max-w-md">
          You don't have any active yield positions yet. Explore strategies to start earning rewards on your assets.
        </p>
        <Button variant="primary">
          Explore Strategies
        </Button>
      </div>
    );
  }

  // Success state - display total value and positions in responsive grid
  return (
    <div className="space-y-6">
      {/* Total Yield Position Value */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border border-light-glassBorder dark:border-dark-glassBorder bg-light-glassBackground dark:bg-dark-glassBackground backdrop-blur-xl p-6"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-light-positive/10 dark:bg-dark-positive/10 p-3">
            <TrendingUp className="w-6 h-6 text-light-positive dark:text-dark-positive" />
          </div>
          <div>
            <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
              Total Yield Position Value
            </p>
            <p className="text-3xl font-bold text-light-textPrimary dark:text-dark-textPrimary">
              {formatUsd(totalValue)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Yield Positions Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {sortedPositions.map((position, index) => (
          <motion.div
            key={`${position.id}-${position.protocol}-${index}`}
            variants={itemVariants}
          >
            <PositionCard position={position} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
