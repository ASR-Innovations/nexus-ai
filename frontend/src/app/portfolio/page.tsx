'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PortfolioOverview } from '@/components/portfolio/portfolio-overview';
import { BalancesList } from '@/components/portfolio/balances-list';
import { YieldPositionsList } from '@/components/portfolio/yield-positions-list';
import { TransactionHistory, TransactionFilters } from '@/components/portfolio/transaction-history';
import { getPortfolioService } from '@/services/portfolio.service';

export default function PortfolioPage() {
  const { isConnected, address } = useAuth();
  const router = useRouter();
  const portfolioService = getPortfolioService();

  // Transaction history state
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>({
    type: 'all',
    dateRange: 'all',
  });
  const pageSize = 20;

  // Protected route - redirect to home if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push('/');
    }
  }, [isConnected, router]);

  // Fetch transaction history
  const { data: transactionData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', address, currentPage, filters],
    queryFn: async () => {
      if (!address) throw new Error('Address is required');
      
      // Build query parameters
      const params: any = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      };

      // Add type filter if not 'all'
      if (filters.type && filters.type !== 'all') {
        params.type = filters.type;
      }

      // Add date range filter
      if (filters.dateRange && filters.dateRange !== 'all') {
        const now = Date.now();
        const ranges: Record<string, number> = {
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
          '90d': 90 * 24 * 60 * 60 * 1000,
        };
        const range = ranges[filters.dateRange];
        if (range) {
          params.startDate = Math.floor((now - range) / 1000);
          params.endDate = Math.floor(now / 1000);
        }
      }

      return portfolioService.getTransactionHistory(address, params);
    },
    enabled: !!address && isConnected,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });

  // Don't render anything if not connected (will redirect)
  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-h1 font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-2">
            Portfolio
          </h1>
          <p className="text-body-md text-light-textSecondary dark:text-dark-textSecondary">
            Your cross-chain assets and yield positions
          </p>
        </div>

        {/* Responsive Layout */}
        <div className="space-y-8">
          {/* Portfolio Overview - Full Width */}
          <section>
            <PortfolioOverview address={address} />
          </section>

          {/* Balances Section - Full Width */}
          <section>
            <h2 className="text-h3 font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-4">
              Balances
            </h2>
            <BalancesList address={address} />
          </section>

          {/* Yield Positions Section - Full Width */}
          <section>
            <h2 className="text-h3 font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-4">
              Yield Positions
            </h2>
            <YieldPositionsList address={address} />
          </section>

          {/* Transaction History - Full Width */}
          <section>
            <TransactionHistory
              transactions={transactionData?.transactions || []}
              loading={transactionsLoading}
              totalCount={transactionData?.count || 0}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onFilterChange={setFilters}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
