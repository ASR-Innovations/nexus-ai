'use client';

import { ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Dropdown({ trigger, children, align = 'end', side = 'bottom' }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={8}
          asChild
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'min-w-[200px] rounded-lg p-2',
              'bg-light-surface dark:bg-dark-surface',
              'border border-light-border dark:border-dark-border',
              'shadow-lg z-50'
            )}
          >
            {children}
          </motion.div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface DropdownItemProps {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({ children, onSelect, disabled, className }: DropdownItemProps) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'px-3 py-2 rounded-md cursor-pointer outline-none',
        'text-body-md text-light-textPrimary dark:text-dark-textPrimary',
        'hover:bg-light-surfaceHover dark:hover:bg-dark-surfaceHover',
        'focus:bg-light-surfaceHover dark:focus:bg-dark-surfaceHover',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors duration-150',
        className
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function DropdownSeparator() {
  return (
    <DropdownMenu.Separator className="h-px my-2 bg-light-border dark:bg-dark-border" />
  );
}
