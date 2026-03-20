'use client';

import { HTMLAttributes, forwardRef } from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, showLabel = false, size = 'md', variant = 'default', ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizes = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    };

    const variants = {
      default: 'bg-light-primary dark:bg-dark-primary',
      success: 'bg-light-success dark:bg-dark-success',
      warning: 'bg-light-warning dark:bg-dark-warning',
      error: 'bg-light-error dark:bg-dark-error',
    };

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-label-sm text-light-textSecondary dark:text-dark-textSecondary">
              Progress
            </span>
            <span className="text-label-sm font-medium text-light-textPrimary dark:text-dark-textPrimary">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
        <ProgressPrimitive.Root
          value={value}
          max={max}
          className={cn(
            'relative overflow-hidden rounded-full',
            'bg-light-backgroundTertiary dark:bg-dark-backgroundTertiary',
            sizes[size]
          )}
        >
          <ProgressPrimitive.Indicator asChild>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={cn('h-full rounded-full', variants[variant])}
            />
          </ProgressPrimitive.Indicator>
        </ProgressPrimitive.Root>
      </div>
    );
  }
);

Progress.displayName = 'Progress';
