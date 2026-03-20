'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  Fuel,
  X,
  TrendingUp,
  Clock,
  Check
} from 'lucide-react';
import { Strategy } from '@/types';
import { cn } from '@/lib/utils';

interface ApprovalDialogProps {
  isOpen: boolean;
  strategy: Strategy | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ApprovalDialog({
  isOpen,
  strategy,
  onConfirm,
  onCancel,
}: ApprovalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    setTimeout(() => firstFocusableRef.current?.focus(), 100);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!strategy) return null;

  const resolvedApy = strategy.apy ?? (strategy.estimatedApyBps != null ? strategy.estimatedApyBps / 100 : 0);
  const resolvedRisk = strategy.risk ?? strategy.riskLevel ?? 'medium';
  const resolvedLockPeriod = strategy.lockPeriod ?? strategy.lockDays ?? 0;
  const apyPercentage = resolvedApy.toFixed(2);
  const isHighRisk = resolvedRisk === 'high';

  const getRiskStyles = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800' };
      case 'medium':
        return { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' };
      case 'high':
        return { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' };
    }
  };

  const riskStyles = getRiskStyles(resolvedRisk);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[1300] bg-black/60"
            onClick={onCancel}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div
            className="fixed inset-0 z-[1400] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
          >
            <motion.div
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#38383A]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-[#38383A] px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2
                    id="dialog-title"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    Confirm Strategy Approval
                  </h2>
                  <button
                    ref={firstFocusableRef}
                    onClick={onCancel}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Strategy Overview */}
                <div
                  id="dialog-description"
                  className="p-4 rounded-xl bg-gray-50 dark:bg-[#2C2C2E]"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {strategy.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <span>{strategy.protocol}</span>
                    <span className="text-gray-400">•</span>
                    <span>{strategy.chain}</span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <TrendingUp className="w-4 h-4 text-green-500" aria-hidden="true" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">APY</span>
                      </div>
                      <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {apyPercentage}%
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Shield className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Risk</span>
                      </div>
                      <div
                        className={cn(
                          'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border',
                          riskStyles.bg,
                          riskStyles.text,
                          riskStyles.border
                        )}
                        role="status"
                        aria-label={`Risk level: ${resolvedRisk}`}
                      >
                        {resolvedRisk.charAt(0).toUpperCase() + resolvedRisk.slice(1)}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Lock</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {resolvedLockPeriod} {resolvedLockPeriod === 1 ? 'day' : 'days'}
                      </p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Fuel className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Gas</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        ${(strategy.estimatedGasUsd ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* High-Risk Warning */}
                {isHighRisk && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-4 rounded-xl border bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                    role="alert"
                    aria-live="polite"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                          High-Risk Strategy Warning
                        </h4>
                        <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                          <li>• This strategy carries significant risk and could result in losses</li>
                          {resolvedLockPeriod > 0 && (
                            <li>• Your funds will be locked for {resolvedLockPeriod} {resolvedLockPeriod === 1 ? 'day' : 'days'}</li>
                          )}
                          {strategy.cons.slice(0, 2).map((con, index) => (
                            <li key={index}>• {con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Pros and Cons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {strategy.pros && strategy.pros.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Advantages
                      </h4>
                      <ul className="space-y-1.5" role="list">
                        {strategy.pros.map((pro, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-900 dark:text-white">
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {strategy.cons && strategy.cons.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Risks & Considerations
                      </h4>
                      <ul className="space-y-1.5" role="list">
                        {strategy.cons.map((con, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-900 dark:text-white">
                            <AlertTriangle className="w-4 h-4 text-yellow-500 dark:text-yellow-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Execution Plan Preview */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Execution Steps
                  </h4>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#2C2C2E]">
                    <div className="space-y-2">
                      {(strategy.executionPlan?.steps ?? []).map((step, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-600 dark:bg-blue-500 text-white text-xs font-semibold" aria-label={`Step ${index + 1}`}>
                            {index + 1}
                          </div>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {step.destinationParaId === 0
                              ? 'Execute on Polkadot Hub'
                              : `Send XCM to parachain ${step.destinationParaId}`}
                          </span>
                        </div>
                      ))}
                      {(strategy.executionPlan?.steps ?? []).length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Execution plan will be generated on confirmation.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Confirmation Notice */}
                <div className="p-4 rounded-xl bg-gray-100 dark:bg-[#2C2C2E]">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    By confirming, you agree to execute this strategy. This will create an intent
                    on-chain and transfer your funds to the smart contract for execution.
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="sticky bottom-0 bg-white dark:bg-[#1C1C1E] border-t border-gray-200 dark:border-[#38383A] px-6 py-4">
                <div className="flex gap-3">
                  <motion.button
                    onClick={onCancel}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-3 rounded-xl font-medium bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-[#38383A] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    aria-label="Cancel and close dialog"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    ref={lastFocusableRef}
                    onClick={onConfirm}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-3 rounded-xl font-medium bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    aria-label="Confirm strategy approval"
                  >
                    Confirm & Execute
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
