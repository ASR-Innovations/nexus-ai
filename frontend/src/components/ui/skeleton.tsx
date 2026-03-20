'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'rectangular', width, height, animation = 'wave', style, ...props }, ref) => {
    const variants = {
      text: 'rounded',
      circular: 'rounded-full',
      rectangular: 'rounded-lg',
    };

    const animations = {
      pulse: 'animate-pulse',
      wave: 'animate-shimmer bg-gradient-to-r from-light-backgroundSecondary via-light-backgroundTertiary to-light-backgroundSecondary dark:from-dark-backgroundSecondary dark:via-dark-backgroundTertiary dark:to-dark-backgroundSecondary bg-[length:200%_100%]',
      none: '',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary',
          variants[variant],
          animations[animation],
          className
        )}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          ...style,
        }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Preset skeleton components for common use cases
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={16}
          width={i === lines - 1 ? '80%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 rounded-xl border border-light-border dark:border-dark-border', className)}>
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-3">
          <Skeleton variant="text" height={20} width="60%" />
          <Skeleton variant="text" height={16} width="100%" />
          <Skeleton variant="text" height={16} width="80%" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton variant="rectangular" height={40} width={120} className={className} />;
}
