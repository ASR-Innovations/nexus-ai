'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glass?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = true, glass = true, children, ...props }, ref) => {
    const baseClassName = cn(
      'rounded-xl p-6 transition-all duration-200',
      glass
        ? 'bg-light-glassBackground dark:bg-dark-glassBackground backdrop-blur-xl border border-light-glassBorder dark:border-dark-glassBorder'
        : 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border',
      className
    );

    if (hover) {
      return (
        <motion.div
          ref={ref}
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ duration: 0.2 }}
          className={cn(baseClassName, 'hover:shadow-lg')}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        className={baseClassName}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
