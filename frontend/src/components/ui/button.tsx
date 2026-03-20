'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, onClick, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-light-primary hover:bg-light-primaryHover active:bg-light-primaryActive text-white focus:ring-light-primary dark:bg-dark-primary dark:hover:bg-dark-primaryHover dark:active:bg-dark-primaryActive dark:focus:ring-dark-primary',
      secondary: 'bg-light-backgroundSecondary hover:bg-light-backgroundTertiary text-light-textPrimary border border-light-border dark:bg-dark-backgroundSecondary dark:hover:bg-dark-backgroundTertiary dark:text-dark-textPrimary dark:border-dark-border',
      ghost: 'hover:bg-light-surfaceHover text-light-textPrimary dark:hover:bg-dark-surfaceHover dark:text-dark-textPrimary',
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-label-sm',
      md: 'px-4 py-2 text-label-md',
      lg: 'px-6 py-3 text-label-lg',
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        onClick={onClick}
        type={props.type}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
