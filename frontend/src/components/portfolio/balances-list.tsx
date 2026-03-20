'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Wallet } from 'lucide-react';
import { BalanceCard } from './balance-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { usePortfolio } from '@/hooks/use-portfolio';

interface BalancesListProps {
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

export function BalancesList({ address }: BalancesListProps) {
  const { data: portfolio, isLoading, isError, error, refetch } = usePortfolio({
    address,
    enabled: !!address,
  });

  // Loading state - show skeleton cards
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
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
            </div>
            <div className="pt-3 mt-3 border-t border-light-glassBorder dark:border-dark-glassBorder">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton variant="text" height={12} width={60} />
                  <Skeleton variant="text" height={20} width={80} />
                </div>
                <div className="space-y-2">
                  <Skeleton variant="text" height={12} width={40} />
                  <Skeleton variant="text" height={16} width={60} />
                </div>
              </div>
            </div>
          </div>
        ))}
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
          Failed to Load Balances
        </h3>
        <p className="text-light-textSecondary dark:text-dark-textSecondary text-center mb-6 max-w-md">
          {error instanceof Error ? error.message : 'An error occurred while fetching your portfolio data.'}
        </p>
        <Button onClick={() => refetch()} variant="primary">
          Retry
        </Button>
      </div>
    );
  }

  // Empty state - no balances found
  if (!portfolio?.balances || portfolio.balances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-light-primary/10 dark:bg-dark-primary/10 p-4 mb-4">
          <Wallet className="w-8 h-8 text-light-primary dark:text-dark-primary" />
        </div>
        <h3 className="text-xl font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-2">
          No Assets Found
        </h3>
        <p className="text-light-textSecondary dark:text-dark-textSecondary text-center mb-6 max-w-md">
          Your wallet doesn't have any assets yet. Add funds to get started with cross-chain DeFi.
        </p>
        <Button variant="primary">
          Add Funds
        </Button>
      </div>
    );
  }

  // Success state - display balances in responsive grid
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {portfolio.balances.map((balance, index) => (
        <motion.div key={`${balance.chain}-${balance.asset}-${index}`} variants={itemVariants}>
          <BalanceCard balance={balance} />
        </motion.div>
      ))}
    </motion.div>
  );
}
