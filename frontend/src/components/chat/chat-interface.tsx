'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { getChatService } from '@/services/chat.service';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { ExecutionTracker } from './execution-tracker';
import { ExecuteConfirmationMessage } from './execute-confirmation-message';
import { ApprovalDialog } from './approval-dialog';
import type { Message, Strategy, IntentStatus, ExecutionPlan } from '@/types';
import { cn } from '@/lib/utils';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface PendingIntent {
  status: IntentStatus;
  strategy: Strategy;
  executionPlan?: ExecutionPlan;
}

interface ChatInterfaceProps {
  className?: string;
}

// ============================================================================
// Main Chat Interface Component
// ============================================================================

export function ChatInterface({ className }: ChatInterfaceProps) {
  // Wallet connection
  const { address, isConnected } = useWallet();

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  // Strategy approval state
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  // Intent tracking state
  const [pendingIntents, setPendingIntents] = useState<Map<number, PendingIntent>>(new Map());
  const [executingIntentId, setExecutingIntentId] = useState<number | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  const chatService = getChatService();

  /**
   * Handle sending a chat message
   */
  const handleSendMessage = useCallback(
    async (messageText: string) => {
      // Check wallet connection
      if (!address || !isConnected) {
        setError('Please connect your wallet to send messages');
        
        // Add user message to show what they tried to send
        const userMessage: Message = {
          role: 'user',
          content: messageText,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMessage]);
        
        // Add error message
        const errorMsg: Message = {
          role: 'assistant',
          content: 'Please connect your wallet to continue. Click the "Connect Wallet" button in the header to get started.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      // Add user message to chat
      const userMessage: Message = {
        role: 'user',
        content: messageText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsProcessing(true);
      setError(null);

      console.log('[Chat Interface] Sending message:', messageText);
      console.log('[Chat Interface] User address:', address);
      console.log('[Chat Interface] Conversation ID:', conversationId);

      // Final validation before API call
      if (!address || typeof address !== 'string' || address.length === 0) {
        throw new Error('Invalid wallet address');
      }

      try {
        // Send message to backend
        console.log('[Chat Interface] Calling chatService.sendMessage...');
        const response = await chatService.sendMessage({
          message: messageText,
          userId: address,
          conversationId,
        });

        console.log('[Chat Interface] Response received:', response);

        // Update conversation ID
        setConversationId(response.conversationId);

        // Create assistant message
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.message,
          strategies: response.strategies,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        console.error('[Chat Interface] Error caught:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        
        // Check if it's an authentication error
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Missing wallet signature')) {
          setError('Authentication failed. Please reconnect your wallet.');
          
          const errorMsg: Message = {
            role: 'assistant',
            content: 'Your wallet session has expired. Please disconnect and reconnect your wallet to continue.',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        } else {
          setError(errorMessage);
          
          // Add error message to chat
          const errorMsg: Message = {
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request. Please try again.',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } finally {
        console.log('[Chat Interface] Setting isProcessing to false');
        setIsProcessing(false);
      }
    },
    [address, isConnected, conversationId, chatService]
  );

  /**
   * Handle strategy approval button click
   */
  const handleApproveStrategy = useCallback((strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowApprovalDialog(true);
  }, []);

  /**
   * Handle strategy rejection
   */
  const handleRejectStrategy = useCallback((strategy: Strategy) => {
    const rejectMessage: Message = {
      role: 'assistant',
      content: `I understand you don't want to proceed with the ${strategy.name} strategy. Would you like me to suggest alternative options or help you with something else?`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, rejectMessage]);
  }, []);

  /**
   * Handle approval dialog confirmation
   */
  const handleApprovalConfirm = useCallback(async () => {
    if (!selectedStrategy || !address) return;

    setShowApprovalDialog(false);
    setIsProcessing(true);

    try {
      // Create intent
      const response = await chatService.createIntent({
        userId: address,
        intentParams: {
          action: 'yield',
          asset: 'PAS',
          amount: '100',
          riskTolerance: selectedStrategy.risk ?? 'medium',
          deadline: Math.floor(Date.now() / 1000) + 86400,
        },
        selectedStrategy,
      });

      if (!response.unsignedTx || !response.intentId) {
        throw new Error('Invalid response from server');
      }

      // Request wallet signature
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: response.unsignedTx.to,
        data: response.unsignedTx.data,
        value: response.unsignedTx.value,
        gasLimit: response.unsignedTx.gasLimit,
      });

      // Add confirmation message
      const confirmMessage: Message = {
        role: 'assistant',
        content: `Great! I've created your intent and it's now being processed. Transaction hash: ${tx.hash}\n\nI'll notify you when an agent picks up your intent and submits an execution plan.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, confirmMessage]);

      // Track this intent
      setPendingIntents((prev) =>
        new Map(prev.set(response.intentId, {
          status: 'PENDING' as IntentStatus,
          strategy: selectedStrategy,
        }))
      );

      // Simulate agent assignment (in production, this would come from WebSocket)
      setTimeout(() => {
        handleIntentAssigned(response.intentId, selectedStrategy);
      }, 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create intent';
      
      // Check if user rejected transaction
      if (errorMessage.includes('user rejected') || errorMessage.includes('User denied')) {
        const cancelMessage: Message = {
          role: 'assistant',
          content: 'Transaction cancelled. Let me know if you\'d like to try again or explore other options.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, cancelMessage]);
      } else {
        setError(errorMessage);
        const errorMsg: Message = {
          role: 'assistant',
          content: 'Sorry, there was an error creating your intent. Please try again.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [selectedStrategy, address, chatService]);

  /**
   * Handle intent assigned by agent
   */
  const handleIntentAssigned = useCallback((intentId: number, strategy: Strategy) => {
    setPendingIntents((prev) => {
      const updated = new Map(prev);
      const intent = updated.get(intentId);
      if (intent) {
        intent.status = 'ASSIGNED' as IntentStatus;
        updated.set(intentId, intent);
      }
      return updated;
    });

    const assignedMessage: Message = {
      role: 'assistant',
      content: 'Good news! An AI agent has been assigned to your intent and is working on the execution plan.',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assignedMessage]);

    // Simulate plan submission
    setTimeout(() => {
      handlePlanSubmitted(intentId, strategy);
    }, 3000);
  }, []);

  /**
   * Handle execution plan submitted
   */
  const handlePlanSubmitted = useCallback((intentId: number, strategy: Strategy) => {
    const executionPlan: ExecutionPlan = {
      steps: strategy.executionPlan?.steps ?? [],
    };

    setPendingIntents((prev) => {
      const updated = new Map(prev);
      const intent = updated.get(intentId);
      if (intent) {
        intent.status = 'PLAN_SUBMITTED' as IntentStatus;
        intent.executionPlan = executionPlan;
        updated.set(intentId, intent);
      }
      return updated;
    });

    const planMessage: Message = {
      role: 'assistant',
      content: `The agent has submitted an execution plan for your ${strategy.name} strategy. Please review and approve it to proceed.`,
      planApproval: {
        intentId,
        strategyName: strategy.name,
        executionPlan,
        estimatedTotalGasUsd: strategy.estimatedGasUsd,
      },
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, planMessage]);
  }, []);

  /**
   * Handle plan approval
   */
  const handleApprovePlan = useCallback(
    async (intentId: number) => {
      if (!address) return;

      const intent = pendingIntents.get(intentId);
      if (!intent) return;

      setIsProcessing(true);

      try {
        // Approve plan
        const response = await chatService.approvePlan({
          intentId,
          userId: address,
        });

        if (!response.unsignedTx) {
          throw new Error('Invalid response from server');
        }

        // Request wallet signature
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();

        const tx = await signer.sendTransaction({
          to: response.unsignedTx.to,
          data: response.unsignedTx.data,
          value: response.unsignedTx.value,
          gasLimit: response.unsignedTx.gasLimit,
        });

        // Update intent status
        setPendingIntents((prev) => {
          const updated = new Map(prev);
          const currentIntent = updated.get(intentId);
          if (currentIntent) {
            currentIntent.status = 'APPROVED' as IntentStatus;
            updated.set(intentId, currentIntent);
          }
          return updated;
        });

        // Add confirmation message
        const approvedMessage: Message = {
          role: 'assistant',
          content: `Perfect! You've approved the execution plan. Transaction hash: ${tx.hash}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, approvedMessage]);

        // Show execute confirmation
        setTimeout(() => {
          const executeMessage: Message = {
            role: 'assistant',
            content: 'Your plan is approved and ready for execution.',
            executeConfirmation: {
              intentId,
              strategyName: intent.strategy.name,
              estimatedGasUsd: intent.strategy.estimatedGasUsd,
            },
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, executeMessage]);
        }, 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to approve plan';
        
        if (errorMessage.includes('user rejected') || errorMessage.includes('User denied')) {
          const cancelMessage: Message = {
            role: 'assistant',
            content: 'Transaction cancelled.',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, cancelMessage]);
        } else {
          setError(errorMessage);
          const errorMsg: Message = {
            role: 'assistant',
            content: 'Sorry, there was an error approving the plan. Please try again.',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [address, pendingIntents, chatService]
  );

  /**
   * Handle plan rejection
   */
  const handleRejectPlan = useCallback((intentId: number) => {
    const rejectMessage: Message = {
      role: 'assistant',
      content: 'I understand you don\'t want to proceed with this execution plan. The intent has been cancelled. Would you like me to suggest alternative strategies?',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, rejectMessage]);

    // Remove from pending intents
    setPendingIntents((prev) => {
      const updated = new Map(prev);
      updated.delete(intentId);
      return updated;
    });
  }, []);

  /**
   * Handle intent execution
   */
  const handleExecuteIntent = useCallback(
    async (intentId: number): Promise<{ txHash: string }> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }

      try {
        // Execute intent
        const response = await chatService.executeIntent({
          intentId,
          userId: address,
        });

        if (!response.unsignedTx) {
          throw new Error('Invalid response from server');
        }

        // Request wallet signature
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();

        const tx = await signer.sendTransaction({
          to: response.unsignedTx.to,
          data: response.unsignedTx.data,
          value: response.unsignedTx.value,
          gasLimit: response.unsignedTx.gasLimit,
        });

        // Update intent status
        setPendingIntents((prev) => {
          const updated = new Map(prev);
          const intent = updated.get(intentId);
          if (intent) {
            intent.status = 'EXECUTING' as IntentStatus;
            updated.set(intentId, intent);
          }
          return updated;
        });

        // Start execution tracking
        setExecutingIntentId(intentId);

        // Add execution message
        const executeMessage: Message = {
          role: 'assistant',
          content: `Excellent! Your strategy execution has started. Transaction hash: ${tx.hash}\n\nI'll track the progress for you.`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, executeMessage]);

        return { txHash: tx.hash };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to execute intent';
        
        if (errorMessage.includes('user rejected') || errorMessage.includes('User denied')) {
          throw new Error('Transaction cancelled by user');
        }
        
        throw err;
      }
    },
    [address, chatService]
  );

  /**
   * Handle execution completion
   */
  const handleExecutionComplete = useCallback(() => {
    const completeMessage: Message = {
      role: 'assistant',
      content: 'Congratulations! Your strategy has been executed successfully. All steps have been completed and confirmed on-chain.',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, completeMessage]);

    // Clear executing intent
    setExecutingIntentId(null);
  }, []);

  /**
   * Handle execution error
   */
  const handleExecutionError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    
    const errorMessage: Message = {
      role: 'assistant',
      content: `Unfortunately, there was an error during execution: ${errorMsg}\n\nPlease check the execution tracker for details.`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, errorMessage]);
  }, []);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        'bg-light-background dark:bg-dark-background',
        className
      )}
    >
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
            role="alert"
            aria-live="assertive"
          >
            <div
              className={cn(
                'flex items-start gap-3 p-4 rounded-2xl shadow-lg',
                'bg-red-50 dark:bg-red-900/20',
                'border border-red-200 dark:border-red-800'
              )}
            >
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Error
                </p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet Connection Prompt */}
      {!isConnected && (
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center max-w-md space-y-6"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-light-primary/10 dark:bg-dark-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-light-primary dark:text-dark-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                Welcome to NexusAI Protocol
              </h2>
              <p className="text-light-textSecondary dark:text-dark-textSecondary">
                Connect your wallet to start describing your DeFi goals in natural language and let AI agents execute them for you.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Chat Interface */}
      {isConnected && (
        <>
          {/* Message List - Scrollable */}
          <MessageList
            messages={messages}
            onApproveStrategy={handleApproveStrategy}
            onRejectStrategy={handleRejectStrategy}
            onApprovePlan={handleApprovePlan}
            onRejectPlan={handleRejectPlan}
          />

          {/* Execution Tracker */}
          <AnimatePresence>
            {executingIntentId && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="shrink-0 px-4 pb-4"
              >
                <ExecutionTracker
                  intentId={executingIntentId}
                  onComplete={handleExecutionComplete}
                  onError={handleExecutionError}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Execute Confirmation Messages */}
          {messages.map((message, index) => {
            if (!message.executeConfirmation) return null;

            return (
              <motion.div
                key={`execute-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="shrink-0 px-4 pb-4"
              >
                <ExecuteConfirmationMessage
                  intentId={message.executeConfirmation.intentId}
                  strategyName={message.executeConfirmation.strategyName}
                  estimatedGasUsd={message.executeConfirmation.estimatedGasUsd}
                  onExecute={handleExecuteIntent}
                />
              </motion.div>
            );
          })}

          {/* Chat Input - Fixed at Bottom */}
          <div className="shrink-0">
            <ChatInput
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              disabled={!isConnected}
              showSuggestedPrompts={messages.length === 0}
            />
          </div>
        </>
      )}

      {/* Approval Dialog */}
      <ApprovalDialog
        isOpen={showApprovalDialog}
        strategy={selectedStrategy}
        onConfirm={handleApprovalConfirm}
        onCancel={() => setShowApprovalDialog(false)}
      />
    </div>
  );
}
