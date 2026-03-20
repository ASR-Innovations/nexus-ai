'use client';

import { ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={className}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-lg',
        'bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary',
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        'relative px-4 py-2 rounded-md',
        'text-label-md font-medium',
        'text-light-textSecondary dark:text-dark-textSecondary',
        'hover:text-light-textPrimary dark:hover:text-dark-textPrimary',
        'data-[state=active]:text-light-textPrimary dark:data-[state=active]:text-dark-textPrimary',
        'transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary',
        className
      )}
    >
      <span className="relative z-10">{children}</span>
      <TabsPrimitive.Trigger value={value} asChild>
        <motion.div
          layoutId="tab-indicator"
          className="absolute inset-0 rounded-md bg-light-surface dark:bg-dark-surface shadow-sm"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      </TabsPrimitive.Trigger>
    </TabsPrimitive.Trigger>
  );
}

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn('mt-4 focus:outline-none', className)}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </TabsPrimitive.Content>
  );
}
