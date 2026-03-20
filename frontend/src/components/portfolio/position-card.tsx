'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Calendar, Lock, Gift } from 'lucide-react';
import { YieldPosition } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PositionCardProps {
  position: YieldPosition;
}

// Protocol icon mapping
const getProtocolIcon = (protocol: string): string => {
  const protocolIcons: Record<string, string> = {
    'Hydration': '💧',
    'Bifrost': '🌈',
    'Moonbeam': '🌙',
    'Acala': '🔴',
  };
  return protocolIcons[protocol] || '⬤';
};

// Format balance with appropriate decimals
const formatBalance = (amount: string): string => {
  const num = parseFloat(amount);
  if (num === 0) return '0';
  if (num < 0.000001) return '< 0.000001';
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
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

// Format APY from basis points
const formatApy = (apyBps: number | undefined): string => {
  if (!apyBps) return '0.00%';
  const apy = apyBps / 100;
  return `${apy.toFixed(2)}%`;
};

// Get APY color based on value
const getApyColor = (apyBps: number): string => {
  const apy = apyBps / 100;
  if (apy > 15) return 'text-light-positive dark:text-dark-positive';
  if (apy >= 5) return 'text-light-warning dark:text-dark-warning';
  return 'text-light-textSecondary dark:text-dark-textSecondary';
};

// Format date
const formatDate = (timestamp: number | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Calculate lock period (placeholder - would need additional data)
const getLockPeriod = (): string | null => {
  // This would come from additional position data
  return null;
};

export function PositionCard({ position }: PositionCardProps) {
  // Use apy if available (in percentage), otherwise convert apyBps to percentage
  const apy = position.apy ?? (position.apyBps ? position.apyBps / 100 : 0);
  const isHighYield = apy > 20;
  const apyColor = getApyColor(position.apyBps ?? (position.apy ? position.apy * 100 : 0));
  const lockPeriod = getLockPeriod();

  // Calculate rewards (current value - deposited amount)
  const depositedValue = parseFloat(position.depositedAmount ?? position.amount ?? '0');
  const currentValueNum = parseFloat(position.currentValue ?? position.amount ?? '0');
  const rewardsValue = currentValueNum - depositedValue;
  const rewardsUsd = position.rewardsUsd ?? parseFloat(position.accruedValue ?? '0');

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
        {/* Protocol Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 flex items-center justify-center text-xl">
              {getProtocolIcon(position.protocol)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                {position.protocol}
              </h3>
              <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                {position.asset} • {position.chain}
              </p>
            </div>
          </div>
          {isHighYield && (
            <Badge variant="success" size="sm">
              High Yield
            </Badge>
          )}
        </div>

        {/* Position Values */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary mb-1">
              Deposited
            </p>
            <p className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              {formatBalance(position.depositedAmount ?? position.amount ?? '0')}
            </p>
            <p className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
              {position.asset}
            </p>
          </div>
          <div>
            <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary mb-1">
              Current Value
            </p>
            <p className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              {formatUsd(position.valueUsd ?? parseFloat(position.currentValue ?? '0'))}
            </p>
            <p className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
              {formatBalance(position.currentValue ?? position.amount ?? '0')} {position.asset}
            </p>
          </div>
        </div>

        {/* APY Display */}
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-light-backgroundSecondary/50 dark:bg-dark-backgroundSecondary/50">
          <TrendingUp className={`w-4 h-4 ${apyColor}`} />
          <span className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
            APY:
          </span>
          <span className={`text-lg font-bold ${apyColor}`}>
            {formatApy(position.apyBps)}
          </span>
        </div>

        {/* Rewards */}
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-light-positive/5 dark:bg-dark-positive/5 border border-light-positive/20 dark:border-dark-positive/20">
          <Gift className="w-4 h-4 text-light-positive dark:text-dark-positive" />
          <div className="flex-1">
            <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary">
              Accumulated Rewards
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-light-positive dark:text-dark-positive">
                {formatBalance(rewardsValue.toString())} {position.asset}
              </span>
              <span className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
                ({formatUsd(rewardsUsd)})
              </span>
            </div>
          </div>
        </div>

        {/* Start Date and Lock Period */}
        <div className="flex items-center justify-between pt-3 border-t border-light-glassBorder dark:border-dark-glassBorder">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-light-textTertiary dark:text-dark-textTertiary" />
            <div>
              <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary">
                Started
              </p>
              <p className="text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary">
                {formatDate(position.startedAt)}
              </p>
            </div>
          </div>
          {lockPeriod && (
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-light-textTertiary dark:text-dark-textTertiary" />
              <div className="text-right">
                <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary">
                  Lock Period
                </p>
                <p className="text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary">
                  {lockPeriod}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
