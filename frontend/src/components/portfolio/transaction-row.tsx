'use client';

import { motion } from 'framer-motion';
import {
  ArrowRightLeft,
  Send,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Transaction, TransactionType } from '@/types/api.types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TransactionRowProps {
  transaction: Transaction;
  onClick?: () => void;
}

// Transaction type icon mapping
const getTransactionIcon = (type: TransactionType) => {
  const iconClass = 'w-4 h-4';
  switch (type) {
    case TransactionType.SWAP:
      return <ArrowRightLeft className={iconClass} />;
    case TransactionType.TRANSFER:
      return <Send className={iconClass} />;
    case TransactionType.LIQUIDITY_ADD:
      return <Plus className={iconClass} />;
    case TransactionType.LIQUIDITY_REMOVE:
      return <Minus className={iconClass} />;
    case TransactionType.STAKE:
      return <TrendingUp className={iconClass} />;
    case TransactionType.UNSTAKE:
      return <TrendingDown className={iconClass} />;
    default:
      return <ArrowRightLeft className={iconClass} />;
  }
};

// Transaction type label
const getTransactionLabel = (type: TransactionType): string => {
  switch (type) {
    case TransactionType.SWAP:
      return 'Swap';
    case TransactionType.TRANSFER:
      return 'Transfer';
    case TransactionType.LIQUIDITY_ADD:
      return 'Add Liquidity';
    case TransactionType.LIQUIDITY_REMOVE:
      return 'Remove Liquidity';
    case TransactionType.STAKE:
      return 'Stake';
    case TransactionType.UNSTAKE:
      return 'Unstake';
    default:
      return 'Transaction';
  }
};

// Format relative time
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format amount
const formatAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (num === 0) return '0';
  if (num < 0.000001) return '< 0.000001';
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

// Format USD value
const formatUsd = (value: number): string => {
  if (value === 0) return '$0.00';
  if (value < 0.01) return '< $0.01';
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Get status badge variant
const getStatusVariant = (status: 'confirmed' | 'pending' | 'failed') => {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

// Get status label
const getStatusLabel = (status: 'confirmed' | 'pending' | 'failed'): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const isClickable = !!onClick;

  return (
    <motion.div
      whileHover={isClickable ? { scale: 1.01 } : undefined}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg',
        'bg-light-surface dark:bg-dark-surface',
        'border border-light-border dark:border-dark-border',
        'transition-all duration-200',
        isClickable && 'cursor-pointer hover:shadow-md hover:border-light-primary/30 dark:hover:border-dark-primary/30'
      )}
    >
      {/* Icon */}
      <div className="shrink-0 w-10 h-10 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 flex items-center justify-center text-light-primary dark:text-dark-primary">
        {getTransactionIcon(transaction.type)}
      </div>

      {/* Transaction Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">
            {getTransactionLabel(transaction.type)}
          </h4>
          <Badge variant={getStatusVariant(transaction.status)} size="sm">
            {getStatusLabel(transaction.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-light-textSecondary dark:text-dark-textSecondary">
          <span>{formatRelativeTime(transaction.timestamp)}</span>
          {transaction.chain && (
            <>
              <span>•</span>
              <span>{transaction.chain}</span>
            </>
          )}
        </div>
      </div>

      {/* Amount and Value */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary">
          {formatAmount(transaction.amount)}
        </p>
        <p className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
          {formatUsd(transaction.valueUsd)}
        </p>
      </div>
    </motion.div>
  );
}
