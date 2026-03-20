'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot } from 'lucide-react';
import { Message, Strategy } from '@/types';
import { cn } from '@/lib/utils';
import { StrategyCard } from './strategy-card';
import { PlanApprovalMessage } from './plan-approval-message';

interface MessageListProps {
  messages: Message[];
  onApproveStrategy?: (strategy: Strategy) => void;
  onRejectStrategy?: (strategy: Strategy) => void;
  onApprovePlan?: (intentId: number) => void;
  onRejectPlan?: (intentId: number) => void;
  onExecute?: (intentId: number) => void;
}

export function MessageList({
  messages,
  onApproveStrategy,
  onRejectStrategy,
  onApprovePlan,
  onRejectPlan,
  onExecute,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      <AnimatePresence initial={false}>
        {messages.map((message, index) => (
          <motion.div
            key={`${message.timestamp}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {/* Assistant Avatar */}
            {message.role === 'assistant' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-light-primary dark:text-dark-primary" />
              </div>
            )}

            {/* Message Content */}
            <div
              className={cn(
                'max-w-[70%] space-y-2',
                message.role === 'user' ? 'items-end' : 'items-start'
              )}
            >
              {/* Message Bubble */}
              <div
                className={cn(
                  'rounded-2xl px-4 py-3 shadow-sm transition-all duration-200',
                  message.role === 'user'
                    ? 'bg-blue-100 text-gray-900 dark:bg-blue-600 dark:text-white font-medium'
                    : 'bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] text-gray-900 dark:text-white'
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              </div>

              {/* Timestamp */}
              <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary px-2">
                {formatTime(message.timestamp)}
              </p>

              {/* Strategy Cards */}
              {message.strategies && message.strategies.length > 0 && (
                <div className="space-y-3 mt-3">
                  {message.strategies.map((strategy, strategyIndex) => (
                    <StrategyCard
                      key={`${strategy.name}-${strategyIndex}`}
                      strategy={strategy}
                      onApprove={(strategy) => onApproveStrategy?.(strategy)}
                      onReject={(strategy) => onRejectStrategy?.(strategy)}
                    />
                  ))}
                </div>
              )}

              {/* Plan Approval Message */}
              {message.planApproval && (
                <PlanApprovalMessage
                  intentId={message.planApproval.intentId}
                  strategyName={message.planApproval.strategyName}
                  executionPlan={message.planApproval.executionPlan ?? { steps: [] }}
                  estimatedTotalGasUsd={message.planApproval.estimatedTotalGasUsd ?? 0}
                  onApprovePlan={onApprovePlan || (() => {})}
                  onRejectPlan={onRejectPlan || (() => {})}
                  className="mt-3"
                />
              )}

              {/* Execute Confirmation Message */}
              {message.executeConfirmation && (
                <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg p-4 mt-3">
                  <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                    Execute Confirmation Placeholder
                  </p>
                  <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary mt-1">
                    Intent ID: {message.executeConfirmation.intentId} | Strategy: {message.executeConfirmation.strategyName}
                  </p>
                  <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary">
                    Gas: ${message.executeConfirmation.estimatedGasUsd.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* User Avatar */}
            {message.role === 'user' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-light-primary dark:text-dark-primary" />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Auto-scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}
