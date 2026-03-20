'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getChatService } from '@/services/chat.service';
import type { ExecutionStatusResponse, ExecutionStepInfo, XCMMessageInfo } from '@/types/api.types';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ExecutionTrackerProps {
  intentId: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
type ExecutionStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get block explorer URL for a transaction hash
 * Defaults to Polkadot Subscan
 */
function getBlockExplorerUrl(txHash: string, paraId?: number): string {
  // Map para IDs to their respective explorers
  const explorerMap: Record<number, string> = {
    0: 'https://polkadot.subscan.io/extrinsic',
    2034: 'https://hydration.subscan.io/extrinsic',
    2030: 'https://bifrost.subscan.io/extrinsic',
    2004: 'https://moonbeam.subscan.io/extrinsic',
  };

  const baseUrl = paraId ? explorerMap[paraId] : explorerMap[0];
  return `${baseUrl || explorerMap[0]}/${txHash}`;
}

/**
 * Get chain name from para ID
 */
function getChainName(paraId: number): string {
  const chainMap: Record<number, string> = {
    0: 'Polkadot',
    2034: 'Hydration',
    2030: 'Bifrost',
    2004: 'Moonbeam',
  };
  return chainMap[paraId] || `Para ${paraId}`;
}

/**
 * Format timestamp to readable time
 */
function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString();
}

// ============================================================================
// Step Status Icon Component
// ============================================================================

interface StepStatusIconProps {
  status: StepStatus;
  className?: string;
}

function StepStatusIcon({ status, className }: StepStatusIconProps) {
  const iconProps = {
    className: cn('w-5 h-5', className),
    'aria-hidden': true,
  };

  switch (status) {
    case 'completed':
      return <CheckCircle {...iconProps} className={cn(iconProps.className, 'text-light-success dark:text-dark-success')} />;
    case 'in_progress':
      return <Loader2 {...iconProps} className={cn(iconProps.className, 'text-light-primary dark:text-dark-primary animate-spin')} />;
    case 'failed':
      return <XCircle {...iconProps} className={cn(iconProps.className, 'text-light-error dark:text-dark-error')} />;
    case 'pending':
    default:
      return <Clock {...iconProps} className={cn(iconProps.className, 'text-light-textTertiary dark:text-dark-textTertiary')} />;
  }
}

// ============================================================================
// Execution Step Component
// ============================================================================

interface ExecutionStepProps {
  step: ExecutionStepInfo;
  index: number;
}

function ExecutionStep({ step, index }: ExecutionStepProps) {
  const chainName = getChainName(step.destination_para_id);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl',
        'bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary',
        'border border-light-border dark:border-dark-border'
      )}
    >
      {/* Status Icon */}
      <div className="shrink-0 mt-0.5">
        <StepStatusIcon status={step.status} />
      </div>

      {/* Step Details */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary">
            Step {step.step_index + 1}: {chainName}
          </h4>
          {step.executed_at && (
            <span className="text-xs text-light-textTertiary dark:text-dark-textTertiary">
              {formatTimestamp(step.executed_at)}
            </span>
          )}
        </div>

        {/* Target Contract */}
        <div className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
          <span className="font-medium">Target:</span>{' '}
          <code className="bg-light-surface dark:bg-dark-surface px-1.5 py-0.5 rounded">
            {step.target_contract.slice(0, 10)}...{step.target_contract.slice(-8)}
          </code>
        </div>

        {/* Transaction Hash */}
        {step.tx_hash && (
          <motion.a
            href={getBlockExplorerUrl(step.tx_hash, step.destination_para_id)}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs',
              'text-light-primary dark:text-dark-primary',
              'hover:underline',
              'focus:outline-none focus:ring-2 focus:ring-light-primary/20 dark:focus:ring-dark-primary/20 rounded'
            )}
            aria-label={`View transaction ${step.tx_hash} on block explorer`}
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span>View Transaction</span>
          </motion.a>
        )}

        {/* Error Message */}
        {step.error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={cn(
              'flex items-start gap-2 p-2 rounded-lg',
              'bg-red-50 dark:bg-red-900/10',
              'border border-red-200 dark:border-red-800'
            )}
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-red-700 dark:text-red-400">{step.error}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// XCM Message Component
// ============================================================================

interface XCMMessageProps {
  message: XCMMessageInfo;
  index: number;
}

function XCMMessage({ message, index }: XCMMessageProps) {
  const chainName = getChainName(message.para_id);
  const statusColors = {
    pending: 'text-light-textTertiary dark:text-dark-textTertiary',
    dispatched: 'text-yellow-600 dark:text-yellow-400',
    confirmed: 'text-light-success dark:text-dark-success',
    failed: 'text-light-error dark:text-dark-error',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={cn(
        'flex items-center justify-between gap-3 p-3 rounded-lg',
        'bg-light-backgroundTertiary dark:bg-dark-backgroundTertiary'
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Activity className="w-4 h-4 text-light-textSecondary dark:text-dark-textSecondary shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-light-textPrimary dark:text-dark-textPrimary">
            XCM to {chainName}
          </p>
          <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary truncate">
            {message.xcm_message_hash.slice(0, 16)}...
          </p>
        </div>
      </div>
      <span className={cn('text-xs font-medium capitalize', statusColors[message.status])}>
        {message.status}
      </span>
    </motion.div>
  );
}

// ============================================================================
// Main Execution Tracker Component
// ============================================================================

export function ExecutionTracker({
  intentId,
  onComplete,
  onError,
  className,
}: ExecutionTrackerProps) {
  const [status, setStatus] = useState<ExecutionStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const chatService = getChatService();

  /**
   * Fetch execution status from the backend
   */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await chatService.getExecutionStatus(intentId);
      setStatus(response);
      setError(null);

      // Check if execution is complete or failed
      const executionStatus = response.execution.status;
      if (executionStatus === 'completed' || executionStatus === 'failed') {
        setIsPolling(false);

        if (executionStatus === 'completed' && onComplete) {
          onComplete();
        } else if (executionStatus === 'failed' && onError) {
          onError(response.execution.error_message || 'Execution failed');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch execution status';
      setError(errorMessage);
      
      // Don't stop polling on network errors, but notify parent
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [intentId, chatService, onComplete, onError]);

  /**
   * Poll execution status every 5 seconds
   */
  useEffect(() => {
    if (!isPolling) return;

    // Fetch immediately on mount
    fetchStatus();

    // Set up polling interval
    const intervalId = setInterval(() => {
      setPollCount((prev) => prev + 1);
      fetchStatus();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPolling, fetchStatus]);

  // Calculate progress percentage
  const progressPercentage = status
    ? Math.round((status.execution.completed_steps / status.execution.total_steps) * 100)
    : 0;

  const executionStatus = status?.execution.status || 'pending';
  const isComplete = executionStatus === 'completed';
  const isFailed = executionStatus === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-light-glassBackground dark:bg-dark-glassBackground',
        'backdrop-blur-xl',
        'border border-light-glassBorder dark:border-dark-glassBorder',
        'shadow-lg',
        className
      )}
      role="region"
      aria-label="Execution progress tracker"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Execution Progress
            </h3>
            {isPolling && !isFailed && (
              <div className="flex items-center gap-2 text-xs text-light-textSecondary dark:text-dark-textSecondary">
                <div className="w-2 h-2 rounded-full bg-light-primary dark:bg-dark-primary animate-pulse" />
                <span>Live</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-light-textSecondary dark:text-dark-textSecondary">
                {status?.execution.completed_steps || 0} of {status?.execution.total_steps || 0} steps completed
              </span>
              <span className="font-medium text-light-textPrimary dark:text-dark-textPrimary">
                {progressPercentage}%
              </span>
            </div>
            <div className="h-2 bg-light-backgroundTertiary dark:bg-dark-backgroundTertiary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={cn(
                  'h-full rounded-full',
                  isComplete && 'bg-light-success dark:bg-dark-success',
                  isFailed && 'bg-light-error dark:bg-dark-error',
                  !isComplete && !isFailed && 'bg-light-primary dark:bg-dark-primary'
                )}
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex items-start gap-2 p-4 rounded-xl',
              'bg-red-50 dark:bg-red-900/10',
              'border border-red-200 dark:border-red-800'
            )}
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                Error fetching status
              </p>
              <p className="text-xs text-red-600 dark:text-red-500">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Execution Steps */}
        {status && status.steps.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary">
              Execution Steps
            </h4>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {status.steps.map((step, index) => (
                  <ExecutionStep key={step.id} step={step} index={index} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* XCM Messages */}
        {status && status.xcmMessages.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary">
              Cross-Chain Messages
            </h4>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {status.xcmMessages.map((message, index) => (
                  <XCMMessage key={message.id} message={message} index={index} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Success Message */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl',
              'bg-green-50 dark:bg-green-900/10',
              'border border-green-200 dark:border-green-800'
            )}
          >
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Execution Completed Successfully
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                All steps have been executed and confirmed on-chain
              </p>
            </div>
          </motion.div>
        )}

        {/* Failure Message */}
        {isFailed && status?.execution.error_message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'flex items-start gap-3 p-4 rounded-xl',
              'bg-red-50 dark:bg-red-900/10',
              'border border-red-200 dark:border-red-800'
            )}
          >
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Execution Failed
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                {status.execution.error_message}
              </p>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {!status && !error && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-light-primary dark:text-dark-primary animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading execution status...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
