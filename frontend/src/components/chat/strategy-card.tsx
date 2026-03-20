'use client';

import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Shield, 
  Clock, 
  Fuel, 
  Check, 
  X, 
  ThumbsUp, 
  ThumbsDown,
  Zap
} from 'lucide-react';
import { Strategy } from '@/types';
import { cn } from '@/lib/utils';

interface StrategyCardProps {
  strategy: Strategy;
  onApprove: (strategy: Strategy) => void;
  onReject: (strategy: Strategy) => void;
  className?: string;
}

export function StrategyCard({
  strategy,
  onApprove,
  onReject,
  className,
}: StrategyCardProps) {
  const resolvedApy = strategy.apy ?? (strategy.estimatedApyBps != null ? strategy.estimatedApyBps / 100 : 0);
  const resolvedRisk = strategy.risk ?? strategy.riskLevel ?? 'medium';
  const resolvedLockPeriod = strategy.lockPeriod ?? strategy.lockDays ?? 0;
  const apyPercentage = resolvedApy.toFixed(2);
  const isHighYield = resolvedApy > 20;

  // Risk level styling
  const getRiskStyles = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return {
          bg: 'bg-green-100 dark:bg-green-900/20',
          text: 'text-green-700 dark:text-green-400',
          border: 'border-green-200 dark:border-green-800',
        };
      case 'medium':
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/20',
          text: 'text-yellow-700 dark:text-yellow-400',
          border: 'border-yellow-200 dark:border-yellow-800',
        };
      case 'high':
        return {
          bg: 'bg-red-100 dark:bg-red-900/20',
          text: 'text-red-700 dark:text-red-400',
          border: 'border-red-200 dark:border-red-800',
        };
    }
  };

  const riskStyles = getRiskStyles(resolvedRisk);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-white dark:bg-[#1C1C1E]',
        'border border-gray-200 dark:border-[#38383A]',
        'shadow-md hover:shadow-lg',
        'transition-shadow duration-300',
        className
      )}
      role="article"
      aria-label={`Strategy: ${strategy.name}`}
    >
      {/* High Yield Badge */}
      {isHighYield && (
        <div className="absolute top-4 right-4 z-10">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full',
              'bg-gradient-to-r from-yellow-400 to-orange-500',
              'text-white text-xs font-semibold shadow-md'
            )}
            aria-label="High yield strategy"
          >
            <Zap className="w-3 h-3" />
            <span>High Yield</span>
          </motion.div>
        </div>
      )}

      {/* Card Content */}
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {strategy.name}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {strategy.protocol}
            </span>
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {strategy.chain}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* APY */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">APY</span>
            </div>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {apyPercentage}%
            </p>
          </div>

          {/* Risk Level */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Shield className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">Risk</span>
            </div>
            <div
              className={cn(
                'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border',
                riskStyles.bg,
                riskStyles.text,
                riskStyles.border
              )}
              role="status"
              aria-label={`Risk level: ${resolvedRisk}`}
            >
              {resolvedRisk.charAt(0).toUpperCase() + resolvedRisk.slice(1)}
            </div>
          </div>

          {/* Lock Period */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">Lock</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {resolvedLockPeriod} {resolvedLockPeriod === 1 ? 'day' : 'days'}
            </p>
          </div>

          {/* Gas Cost */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Fuel className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">Gas</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              ${(strategy.estimatedGasUsd ?? 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Pros and Cons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Pros */}
          {strategy.pros && strategy.pros.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Pros
              </h4>
              <ul className="space-y-1.5" role="list">
                {strategy.pros.map((pro, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-900 dark:text-white"
                  >
                    <Check
                      className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cons */}
          {strategy.cons && strategy.cons.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Cons
              </h4>
              <ul className="space-y-1.5" role="list">
                {strategy.cons.map((con, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-900 dark:text-white"
                  >
                    <X
                      className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {/* Reject Button */}
          <motion.button
            onClick={() => onReject(strategy)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
              'bg-white dark:bg-[#2C2C2E]',
              'border-2 border-gray-200 dark:border-[#48484A]',
              'text-gray-900 dark:text-white',
              'hover:border-red-400 dark:hover:border-red-500',
              'hover:text-red-600 dark:hover:text-red-400',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-red-500/20'
            )}
            aria-label={`Reject strategy: ${strategy.name}`}
          >
            <ThumbsDown className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Reject</span>
          </motion.button>

          {/* Approve Button */}
          <motion.button
            onClick={() => onApprove(strategy)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
              'bg-blue-600 dark:bg-blue-500',
              'text-white font-medium',
              'hover:bg-blue-700 dark:hover:bg-blue-600',
              'shadow-md hover:shadow-lg',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20'
            )}
            aria-label={`Approve strategy: ${strategy.name}`}
          >
            <ThumbsUp className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Approve</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
