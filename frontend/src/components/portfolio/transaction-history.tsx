'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, ExternalLink, Copy, Check } from 'lucide-react';
import { Transaction, TransactionType } from '@/types/api.types';
import { TransactionRow } from './transaction-row';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownItem } from '@/components/ui/dropdown';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TransactionHistoryProps {
  transactions: Transaction[];
  loading?: boolean;
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onFilterChange?: (filters: TransactionFilters) => void;
}

export interface TransactionFilters {
  type?: TransactionType | 'all';
  dateRange?: 'all' | '24h' | '7d' | '30d' | '90d';
}

// Block explorer URL mapping (placeholder - would be configured per chain)
const getBlockExplorerUrl = (hash: string, chain?: string): string => {
  // This would be configured based on the chain
  return `https://polkadot.subscan.io/extrinsic/${hash}`;
};

// Format full date
const formatFullDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Transaction type filter options
const transactionTypeOptions: Array<{ value: TransactionType | 'all'; label: string }> = [
  { value: 'all', label: 'All Types' },
  { value: TransactionType.SWAP, label: 'Swap' },
  { value: TransactionType.TRANSFER, label: 'Transfer' },
  { value: TransactionType.LIQUIDITY_ADD, label: 'Add Liquidity' },
  { value: TransactionType.LIQUIDITY_REMOVE, label: 'Remove Liquidity' },
  { value: TransactionType.STAKE, label: 'Stake' },
  { value: TransactionType.UNSTAKE, label: 'Unstake' },
];

// Date range filter options
const dateRangeOptions: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Time' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

export function TransactionHistory({
  transactions,
  loading = false,
  totalCount = 0,
  currentPage = 1,
  pageSize = 20,
  onPageChange,
  onFilterChange,
}: TransactionHistoryProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({
    type: 'all',
    dateRange: 'all',
  });
  const [copiedHash, setCopiedHash] = useState(false);

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const handleFilterChange = (newFilters: Partial<TransactionFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange?.(updatedFilters);
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch (err) {
      console.error('Failed to copy hash:', err);
    }
  };

  const handleOpenBlockExplorer = (hash: string, chain?: string) => {
    const url = getBlockExplorerUrl(hash, chain);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Get current filter labels
  const typeLabel = transactionTypeOptions.find(opt => opt.value === filters.type)?.label || 'All Types';
  const dateLabel = dateRangeOptions.find(opt => opt.value === filters.dateRange)?.label || 'All Time';

  return (
    <div className="space-y-4">
      {/* Header with Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-h3 font-semibold text-light-textPrimary dark:text-dark-textPrimary">
          Transaction History
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Type Filter */}
          <Dropdown
            trigger={
              <Button variant="secondary" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                {typeLabel}
              </Button>
            }
          >
            {transactionTypeOptions.map(option => (
              <DropdownItem
                key={option.value}
                onSelect={() => handleFilterChange({ type: option.value })}
              >
                {option.label}
              </DropdownItem>
            ))}
          </Dropdown>

          {/* Date Range Filter */}
          <Dropdown
            trigger={
              <Button variant="secondary" size="sm">
                {dateLabel}
              </Button>
            }
          >
            {dateRangeOptions.map(option => (
              <DropdownItem
                key={option.value}
                onSelect={() => handleFilterChange({ dateRange: option.value as any })}
              >
                {option.label}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={80} className="rounded-lg" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary flex items-center justify-center mb-4">
            <Filter className="w-8 h-8 text-light-textTertiary dark:text-dark-textTertiary" />
          </div>
          <h3 className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-2">
            No Transactions Found
          </h3>
          <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary max-w-md">
            {filters.type !== 'all' || filters.dateRange !== 'all'
              ? 'No transactions match your current filters. Try adjusting your filter criteria.'
              : 'You haven\'t made any transactions yet. Start by connecting your wallet and making your first transaction.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map(transaction => (
            <TransactionRow
              key={transaction.hash}
              transaction={transaction}
              onClick={() => setSelectedTransaction(transaction)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && transactions.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-light-border dark:border-dark-border">
          <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount} transactions
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={!hasPrevPage}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => onPageChange?.(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={!hasNextPage}
              className="gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      <Modal
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        title="Transaction Details"
      >
        {selectedTransaction && (
          <div className="space-y-4">
            {/* Transaction Hash */}
            <div>
              <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                Transaction Hash
              </label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary">
                <code className="flex-1 text-sm font-mono text-light-textPrimary dark:text-dark-textPrimary break-all">
                  {selectedTransaction.hash}
                </code>
                <button
                  onClick={() => handleCopyHash(selectedTransaction.hash)}
                  className="shrink-0 p-2 rounded-md hover:bg-light-surfaceHover dark:hover:bg-dark-surfaceHover transition-colors"
                  title="Copy hash"
                >
                  {copiedHash ? (
                    <Check className="w-4 h-4 text-light-success dark:text-dark-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-light-textSecondary dark:text-dark-textSecondary" />
                  )}
                </button>
              </div>
            </div>

            {/* Transaction Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                  Type
                </label>
                <p className="text-sm text-light-textPrimary dark:text-dark-textPrimary">
                  {transactionTypeOptions.find(opt => opt.value === selectedTransaction.type)?.label}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                  Status
                </label>
                <p className="text-sm text-light-textPrimary dark:text-dark-textPrimary capitalize">
                  {selectedTransaction.status}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                  Amount
                </label>
                <p className="text-sm text-light-textPrimary dark:text-dark-textPrimary">
                  {selectedTransaction.amount}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                  Value (USD)
                </label>
                <p className="text-sm text-light-textPrimary dark:text-dark-textPrimary">
                  ${selectedTransaction.valueUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {selectedTransaction.chain && (
                <div>
                  <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                    Chain
                  </label>
                  <p className="text-sm text-light-textPrimary dark:text-dark-textPrimary">
                    {selectedTransaction.chain}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                  Timestamp
                </label>
                <p className="text-sm text-light-textPrimary dark:text-dark-textPrimary">
                  {formatFullDate(selectedTransaction.timestamp)}
                </p>
              </div>
            </div>

            {/* From/To Addresses */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                  From
                </label>
                <code className="block text-sm font-mono text-light-textPrimary dark:text-dark-textPrimary p-3 rounded-lg bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary break-all">
                  {selectedTransaction.from}
                </code>
              </div>

              <div>
                <label className="text-xs font-medium text-light-textTertiary dark:text-dark-textTertiary mb-1 block">
                  To
                </label>
                <code className="block text-sm font-mono text-light-textPrimary dark:text-dark-textPrimary p-3 rounded-lg bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary break-all">
                  {selectedTransaction.to}
                </code>
              </div>
            </div>

            {/* Block Explorer Link */}
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={() => handleOpenBlockExplorer(selectedTransaction.hash, selectedTransaction.chain)}
            >
              <ExternalLink className="w-4 h-4" />
              View on Block Explorer
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
