'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Rocket, 
  Fuel, 
  CheckCircle, 
  ExternalLink,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecuteConfirmationMessageProps {
  intentId: number;
  strategyName: string;
  estimatedGasUsd: number;
  onExecute: (intentId: number) => Promise<{ txHash: string }>;
  className?: string;
}

export function ExecuteConfirmationMessage({
  intentId,
  strategyName,
  estimatedGasUsd,
  onExecute,
  className,
}: ExecuteConfirmationMessageProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);

    try {
      const result = await onExecute(intentId);
      setTxHash(result.txHash);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute intent';
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  // Get block explorer URL based on chain (defaulting to Polkadot)
  const getBlockExplorerUrl = (hash: string): string => {
    // For Polkadot/Substrate chains, use Subscan
    return `https://polkadot.subscan.io/extrinsic/${hash}`;
  };

  // If transaction has been sent, show confirmation
  if (txHash) {
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
        role="article"
        aria-label="Execution confirmation"
      >
        <div className="p-6 space-y-4">
          {/* Success Header */}
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-light-success/10 dark:bg-dark-success/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-light-success dark:text-dark-success" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Intent Execution Started
              </h3>
              <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                Transaction submitted successfully
              </p>
            </div>
          </div>

          {/* Strategy Name */}
          <div
            className={cn(
              'p-4 rounded-xl',
              'bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary'
            )}
          >
            <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-1">
              Strategy
            </p>
            <p className="text-base font-medium text-light-textPrimary dark:text-dark-textPrimary">
              {strategyName}
            </p>
          </div>

          {/* Transaction Hash */}
          <div
            className={cn(
              'p-4 rounded-xl',
              'bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary'
            )}
          >
            <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-2">
              Transaction Hash
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono text-light-textPrimary dark:text-dark-textPrimary bg-light-surface dark:bg-dark-surface px-3 py-1.5 rounded-lg break-all">
                {txHash}
              </code>
            </div>
          </div>

          {/* Block Explorer Link */}
          <motion.a
            href={getBlockExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
              'bg-light-primary dark:bg-dark-primary',
              'text-white font-medium',
              'hover:bg-light-primaryHover dark:hover:bg-dark-primaryHover',
              'shadow-md hover:shadow-lg',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-light-primary/20 dark:focus:ring-dark-primary/20'
            )}
            aria-label="View transaction on block explorer"
          >
            <ExternalLink className="w-5 h-5" aria-hidden="true" />
            <span>View on Block Explorer</span>
          </motion.a>

          {/* Info Message */}
          <div
            className={cn(
              'p-3 rounded-lg',
              'bg-light-backgroundTertiary dark:bg-dark-backgroundTertiary'
            )}
          >
            <p className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
              Your intent is now being executed. You can track the progress in real-time as the agent completes each step.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Show execute button
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
      role="article"
      aria-label="Execute intent confirmation"
    >
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-light-primary dark:text-dark-primary" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Ready to Execute
            </h3>
          </div>
          <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
            Execute the approved plan for <span className="font-medium">{strategyName}</span>
          </p>
        </div>

        {/* Gas Cost Display */}
        <div
          className={cn(
            'flex items-center justify-between p-4 rounded-xl',
            'bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary',
            'border border-light-border dark:border-dark-border'
          )}
        >
          <div className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-light-textTertiary dark:text-dark-textTertiary" aria-hidden="true" />
            <span className="text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary">
              Estimated Gas Cost
            </span>
          </div>
          <span className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
            ${estimatedGasUsd.toFixed(2)}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-xl',
              'bg-red-50 dark:bg-red-900/10',
              'border border-red-200 dark:border-red-800'
            )}
            role="alert"
          >
            <p className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          </motion.div>
        )}

        {/* Execute Button */}
        <motion.button
          onClick={handleExecute}
          disabled={isExecuting}
          whileHover={!isExecuting ? { scale: 1.02 } : undefined}
          whileTap={!isExecuting ? { scale: 0.98 } : undefined}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
            'bg-light-primary dark:bg-dark-primary',
            'text-white font-medium',
            'hover:bg-light-primaryHover dark:hover:bg-dark-primaryHover',
            'shadow-md hover:shadow-lg',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-light-primary/20 dark:focus:ring-dark-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
          )}
          aria-label="Execute intent"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span>Executing...</span>
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" aria-hidden="true" />
              <span>Execute Intent</span>
            </>
          )}
        </motion.button>

        {/* Info Message */}
        <div
          className={cn(
            'p-3 rounded-lg',
            'bg-light-backgroundTertiary dark:bg-dark-backgroundTertiary'
          )}
        >
          <p className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
            Clicking execute will prompt you to sign a transaction. Once signed, the agent will begin executing your intent.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
