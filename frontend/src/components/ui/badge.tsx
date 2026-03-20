'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-light-backgroundTertiary text-light-textPrimary dark:bg-dark-backgroundTertiary dark:text-dark-textPrimary',
      success: 'bg-light-success/10 text-light-success dark:bg-dark-success/10 dark:text-dark-success',
      warning: 'bg-light-warning/10 text-light-warning dark:bg-dark-warning/10 dark:text-dark-warning',
      error: 'bg-light-error/10 text-light-error dark:bg-dark-error/10 dark:text-dark-error',
      info: 'bg-light-info/10 text-light-info dark:bg-dark-info/10 dark:text-dark-info',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-label-sm',
      md: 'px-2.5 py-1 text-label-md',
      lg: 'px-3 py-1.5 text-label-lg',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
