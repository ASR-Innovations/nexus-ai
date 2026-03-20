'use client';

import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  Fuel,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanApprovalMessageProps {
  intentId: number;
  strategyName: string;
  executionPlan: ExecutionPlan;
  estimatedTotalGasUsd: number;
  onApprovePlan: (intentId: number) => void;
  onRejectPlan: (intentId: number) => void;
  className?: string;
}

interface ExecutionPlan {
  steps: ExecutionStep[];
}

interface ExecutionStep {
  destinationParaId: number;
  targetContract: string;
  callData: string;
  value: string;
}

export function PlanApprovalMessage({
  intentId,
  strategyName,
  executionPlan,
  estimatedTotalGasUsd,
  onApprovePlan,
  onRejectPlan,
  className,
}: PlanApprovalMessageProps) {
  // Determine if a step is high-risk based on value or destination
  const isHighRiskStep = (step: ExecutionStep): boolean => {
    const valueInWei = BigInt(step.value || '0');
    const highValueThreshold = BigInt('1000000000000000000'); // 1 token (assuming 18 decimals)
    return valueInWei > highValueThreshold;
  };

  // Get chain name from parachain ID
  const getChainName = (paraId: number): string => {
    const chainMap: Record<number, string> = {
      0: 'Polkadot Hub',
      2000: 'Hydration',
      2001: 'Bifrost',
      2004: 'Moonbeam',
    };
    return chainMap[paraId] || `Parachain ${paraId}`;
  };

  // Format contract address for display
  const formatAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
      aria-label="Execution plan approval"
    >
      {/* Card Content */}
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-light-primary dark:text-dark-primary" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Execution Plan Ready
            </h3>
          </div>
          <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
            Review the execution plan for <span className="font-medium">{strategyName}</span>
          </p>
        </div>

        {/* Execution Steps Timeline */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-light-textSecondary dark:text-dark-textSecondary uppercase tracking-wide">
            Execution Steps
          </h4>
          
          <div className="space-y-3">
            {executionPlan.steps.map((step, index) => {
              const isHighRisk = isHighRiskStep(step);
              const isLastStep = index === executionPlan.steps.length - 1;

              return (
                <div key={index} className="relative">
                  {/* Timeline connector */}
                  {!isLastStep && (
                    <div 
                      className="absolute left-4 top-10 w-0.5 h-6 bg-light-border dark:bg-dark-border"
                      aria-hidden="true"
                    />
                  )}

                  {/* Step Card */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    className={cn(
                      'relative flex gap-3 p-4 rounded-xl',
                      'bg-light-surface dark:bg-dark-surface',
                      'border',
                      isHighRisk
                        ? 'border-light-warning dark:border-dark-warning'
                        : 'border-light-border dark:border-dark-border',
                      'transition-all duration-200'
                    )}
                  >
                    {/* Step Number */}
                    <div
                      className={cn(
                        'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                        isHighRisk
                          ? 'bg-light-warning/10 dark:bg-dark-warning/10 text-light-warning dark:text-dark-warning'
                          : 'bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary'
                      )}
                      aria-label={`Step ${index + 1}`}
                    >
                      {index + 1}
                    </div>

                    {/* Step Details */}
                    <div className="flex-1 space-y-2 min-w-0">
                      {/* Chain and Contract */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-light-textPrimary dark:text-dark-textPrimary">
                          {getChainName(step.destinationParaId)}
                        </span>
                        <ArrowRight className="w-4 h-4 text-light-textTertiary dark:text-dark-textTertiary" aria-hidden="true" />
                        <code className="text-xs font-mono text-light-textSecondary dark:text-dark-textSecondary bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary px-2 py-1 rounded">
                          {formatAddress(step.targetContract)}
                        </code>
                      </div>

                      {/* Value Transfer */}
                      {step.value && BigInt(step.value) > 0 && (
                        <div className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
                          Value: {(Number(step.value) / 1e18).toFixed(4)} tokens
                        </div>
                      )}

                      {/* High Risk Warning */}
                      {isHighRisk && (
                        <div className="flex items-center gap-1.5 text-xs text-light-warning dark:text-dark-warning">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>High-value transaction</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gas Cost Summary */}
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
              Estimated Total Gas
            </span>
          </div>
          <span className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
            ${estimatedTotalGasUsd.toFixed(2)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {/* Reject Button */}
          <motion.button
            onClick={() => onRejectPlan(intentId)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
              'bg-light-surface dark:bg-dark-surface',
              'border-2 border-light-border dark:border-dark-border',
              'text-light-textPrimary dark:text-dark-textPrimary',
              'hover:border-light-error dark:hover:border-dark-error',
              'hover:text-light-error dark:hover:text-dark-error',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-light-error/20 dark:focus:ring-dark-error/20'
            )}
            aria-label="Reject execution plan"
          >
            <ThumbsDown className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Reject Plan</span>
          </motion.button>

          {/* Approve Button */}
          <motion.button
            onClick={() => onApprovePlan(intentId)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
              'bg-light-primary dark:bg-dark-primary',
              'text-white font-medium',
              'hover:bg-light-primaryHover dark:hover:bg-dark-primaryHover',
              'shadow-md hover:shadow-lg',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-light-primary/20 dark:focus:ring-dark-primary/20'
            )}
            aria-label="Approve execution plan"
          >
            <ThumbsUp className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Approve Plan</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
