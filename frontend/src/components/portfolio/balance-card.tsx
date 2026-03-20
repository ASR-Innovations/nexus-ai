'use client';

import { motion } from 'framer-motion';
import { Coins, TrendingUp } from 'lucide-react';
import { Balance } from '@/types';
import { Card } from '@/components/ui/card';

interface BalanceCardProps {
  balance: Balance;
}

// Chain icon mapping
const getChainIcon = (chain: string): string => {
  const chainIcons: Record<string, string> = {
    'Polkadot': '⬤',
    'Hydration': '💧',
    'Bifrost': '🌈',
    'Moonbeam': '🌙',
  };
  return chainIcons[chain] || '⬤';
};

// Format balance with appropriate decimals
const formatBalance = (amount: string, decimals: number = 18): string => {
  const num = parseFloat(amount);
  if (num === 0) return '0';
  if (num < 0.000001) return '< 0.000001';
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
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

// Calculate price per token
const calculatePrice = (amount: string, valueUsd: number): number => {
  const amountNum = parseFloat(amount);
  if (amountNum === 0) return 0;
  return valueUsd / amountNum;
};

export function BalanceCard({ balance }: BalanceCardProps) {
  const pricePerToken = calculatePrice(balance.balance, balance.valueUsd);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="group"
    >
      <Card
        glass
        hover={false}
        className="relative overflow-hidden transition-shadow duration-200 group-hover:shadow-xl"
      >
        {/* Asset Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 flex items-center justify-center">
              <Coins className="w-5 h-5 text-light-primary dark:text-dark-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                {balance.asset}
              </h3>
              <div className="flex items-center gap-1.5 text-sm text-light-textSecondary dark:text-dark-textSecondary">
                <span className="text-base">{getChainIcon(balance.chain)}</span>
                <span>{balance.chain}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Amount */}
        <div className="mb-3">
          <p className="text-2xl font-bold text-light-textPrimary dark:text-dark-textPrimary">
            {formatBalance(balance.balance)}
          </p>
          <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
            {balance.asset}
          </p>
        </div>

        {/* USD Value */}
        <div className="flex items-center justify-between pt-3 border-t border-light-glassBorder dark:border-dark-glassBorder">
          <div>
            <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary mb-1">
              Total Value
            </p>
            <p className="text-xl font-semibold text-light-positive dark:text-dark-positive">
              {formatUsd(balance.valueUsd)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary mb-1">
              Price
            </p>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-light-textSecondary dark:text-dark-textSecondary" />
              <p className="text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary">
                {formatUsd(pricePerToken)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
