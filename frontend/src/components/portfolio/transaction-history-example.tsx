/**
 * Example usage of TransactionHistory component
 * 
 * This file demonstrates how to integrate the transaction history
 * components with API calls and state management.
 */

'use client';

import { useState, useEffect } from 'react';
import { TransactionHistory, TransactionFilters } from './transaction-history';
import { Transaction } from '@/types/api.types';

export function TransactionHistoryExample() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>({
    type: 'all',
    dateRange: 'all',
  });

  const pageSize = 20;

  // Fetch transactions from API
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        // Example API call - replace with actual API endpoint
        const params = new URLSearchParams({
          limit: pageSize.toString(),
          offset: ((currentPage - 1) * pageSize).toString(),
          ...(filters.type !== 'all' && { type: filters.type }),
          ...(filters.dateRange !== 'all' && { dateRange: filters.dateRange }),
        });

        const response = await fetch(`/api/portfolio/transactions?${params}`);
        const data = await response.json();

        setTransactions(data.transactions);
        setTotalCount(data.count);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
        setTransactions([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [currentPage, filters]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Optionally scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
    // Reset to first page when filters change
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <TransactionHistory
        transactions={transactions}
        loading={loading}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onFilterChange={handleFilterChange}
      />
    </div>
  );
}
