'use client';

import { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  showClose?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showClose = true,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(
                  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
                  'w-full max-w-lg max-h-[85vh] overflow-y-auto',
                  'rounded-2xl p-6',
                  'bg-light-surface dark:bg-dark-surface',
                  'border border-light-border dark:border-dark-border',
                  'shadow-2xl',
                  className
                )}
              >
                {showClose && (
                  <Dialog.Close asChild>
                    <button
                      className="absolute right-4 top-4 rounded-lg p-2 hover:bg-light-surfaceHover dark:hover:bg-dark-surfaceHover transition-colors"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4 text-light-textSecondary dark:text-dark-textSecondary" />
                    </button>
                  </Dialog.Close>
                )}
                {title && (
                  <Dialog.Title className="text-h3 font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-2">
                    {title}
                  </Dialog.Title>
                )}
                {description && (
                  <Dialog.Description className="text-body-md text-light-textSecondary dark:text-dark-textSecondary mb-4">
                    {description}
                  </Dialog.Description>
                )}
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
