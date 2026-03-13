'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Basic loading spinner
export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
};

// Loading button state
export const LoadingButton: React.FC<{
  loading: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ 
  loading, 
  children, 
  onClick, 
  disabled, 
  variant = 'primary',
  size = 'md',
  className = '' 
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900';
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 disabled:bg-red-800 disabled:cursor-not-allowed',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const spinnerSizes = {
    sm: 'sm' as const,
    md: 'sm' as const,
    lg: 'md' as const,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && (
        <LoadingSpinner 
          size={spinnerSizes[size]} 
          className="mr-2" 
        />
      )}
      {children}
    </button>
  );
};

// Skeleton loading components
export const SkeletonBox: React.FC<{
  width?: string;
  height?: string;
  className?: string;
}> = ({ width = 'w-full', height = 'h-4', className = '' }) => {
  return (
    <div className={`${width} ${height} bg-gray-700 rounded animate-pulse ${className}`} />
  );
};

export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          width={i === lines - 1 ? 'w-3/4' : 'w-full'}
          height="h-4"
        />
      ))}
    </div>
  );
};

// Card skeleton for strategy cards, agent cards, etc.
export const SkeletonCard: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-center space-x-4 mb-4">
        <SkeletonBox width="w-12" height="h-12" className="rounded-full" />
        <div className="flex-1">
          <SkeletonBox width="w-32" height="h-5" className="mb-2" />
          <SkeletonBox width="w-24" height="h-4" />
        </div>
      </div>
      <SkeletonText lines={2} className="mb-4" />
      <div className="flex justify-between items-center">
        <SkeletonBox width="w-20" height="h-6" />
        <SkeletonBox width="w-16" height="h-8" className="rounded" />
      </div>
    </div>
  );
};

// Table skeleton
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBox key={i} width="w-full" height="h-6" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonBox key={colIndex} width="w-full" height="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
};

// Portfolio skeleton
export const SkeletonPortfolio: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Total value */}
      <div className="text-center">
        <SkeletonBox width="w-48" height="h-8" className="mx-auto mb-2" />
        <SkeletonBox width="w-32" height="h-6" className="mx-auto" />
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <SkeletonBox width="w-40" height="h-6" className="mb-4" />
        <SkeletonBox width="w-full" height="h-64" />
      </div>
    </div>
  );
};

// Chat skeleton
export const SkeletonChat: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* User message */}
      <div className="flex justify-end">
        <div className="bg-blue-600 rounded-lg p-3 max-w-xs">
          <SkeletonBox width="w-32" height="h-4" className="bg-blue-500" />
        </div>
      </div>

      {/* AI response */}
      <div className="flex justify-start">
        <div className="bg-gray-700 rounded-lg p-3 max-w-md">
          <SkeletonText lines={3} />
        </div>
      </div>

      {/* Strategy cards */}
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <SkeletonBox width="w-32" height="h-5" className="mb-2" />
                <SkeletonBox width="w-24" height="h-4" />
              </div>
              <SkeletonBox width="w-16" height="h-6" className="rounded-full" />
            </div>
            <SkeletonText lines={2} className="mb-4" />
            <div className="flex gap-2">
              <SkeletonBox width="w-20" height="h-8" className="rounded" />
              <SkeletonBox width="w-20" height="h-8" className="rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Full page loading
export const FullPageLoading: React.FC<{
  message?: string;
}> = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="text-blue-400 mb-4" />
        <p className="text-gray-400 text-lg">{message}</p>
      </div>
    </div>
  );
};

// Inline loading for sections
export const InlineLoading: React.FC<{
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ message = 'Loading...', size = 'md' }) => {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center space-x-3">
        <LoadingSpinner size={size} className="text-blue-400" />
        <span className="text-gray-400">{message}</span>
      </div>
    </div>
  );
};

// Thinking animation for AI responses
export const ThinkingAnimation: React.FC = () => {
  return (
    <div className="flex items-center space-x-1 text-gray-400">
      <span>AI is thinking</span>
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1 h-1 bg-gray-400 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Progress bar for multi-step operations
export const ProgressBar: React.FC<{
  current: number;
  total: number;
  steps?: string[];
  className?: string;
}> = ({ current, total, steps, className = '' }) => {
  const progress = (current / total) * 100;

  return (
    <div className={className}>
      {steps && (
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          {steps.map((step, index) => (
            <span
              key={index}
              className={index < current ? 'text-blue-400' : index === current ? 'text-white' : 'text-gray-600'}
            >
              {step}
            </span>
          ))}
        </div>
      )}
      
      <div className="w-full bg-gray-700 rounded-full h-2">
        <motion.div
          className="bg-blue-600 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Step {current} of {total}</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

// Loading overlay for forms
export const LoadingOverlay: React.FC<{
  loading: boolean;
  message?: string;
  children: React.ReactNode;
}> = ({ loading, message = 'Processing...', children }) => {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <LoadingSpinner size="lg" className="text-blue-400 mb-2" />
            <p className="text-gray-300">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
};