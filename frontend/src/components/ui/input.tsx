'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  state?: 'default' | 'error' | 'success';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, success, state = 'default', ...props }, ref) => {
    const stateStyles = {
      default: 'border-light-border focus:border-light-primary dark:border-dark-border dark:focus:border-dark-primary',
      error: 'border-light-error focus:border-light-error dark:border-dark-error dark:focus:border-dark-error',
      success: 'border-light-success focus:border-light-success dark:border-dark-success dark:focus:border-dark-success',
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-label-md text-light-textSecondary dark:text-dark-textSecondary mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-2 rounded-lg',
            'bg-light-surface dark:bg-dark-surface',
            'text-light-textPrimary dark:text-dark-textPrimary',
            'border-2 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'placeholder:text-light-textTertiary dark:placeholder:text-dark-textTertiary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            stateStyles[state],
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-label-sm text-light-error dark:text-dark-error">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-1 text-label-sm text-light-success dark:text-dark-success">
            {success}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
