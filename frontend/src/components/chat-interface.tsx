"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { StrategyCard } from "./strategy-card";
import { ApprovalDialog } from "./approval-dialog";
import { ExecutionTracker } from "./execution-tracker";
import { PlanApprovalMessage } from "./plan-approval-message";
import { ExecuteConfirmationMessage } from "./execute-confirmation-message";
import { Message, Strategy, IntentStatus } from "@/types";
import { Send, Loader2 } from "lucide-react";

export function ChatInterface() {
  const { isConnected, connect, address } = useWallet();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [executingIntentId, setExecutingIntentId] = useState<number | null>(null);
  const [pendingIntents, setPendingIntents] = useState<Map<number, { status: IntentStatus, strategy: Strategy }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    
    const userMessage: Message = {
      role: 'user',
      content: message.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          userId: address
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.clarificationQuestion || 'Here are the strategies I found for you:',
          strategies: data.strategies,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered a network error. Please check your connection and try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleStrategyApprove = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowApprovalDialog(true);
  };

  const handleStrategyReject = (strategy: Strategy) => {
    const rejectMessage: Message = {
      role: 'assistant',
      content: `I understand you don't want to proceed with the ${strategy.name} strategy. Would you like me to suggest alternative options or help you with something else?`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, rejectMessage]);
  };

  const handleApprovalConfirm = async (strategy: Strategy) => {
    setShowApprovalDialog(false);
    
    try {
      // Create intent
      const response = await fetch('/api/intent/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: address,
          selectedStrategy: strategy
        })
      });

      const data = await response.json();
      
      if (data.unsignedTx && data.intentId) {
        // Request wallet signature
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        
        const tx = await signer.sendTransaction({
          to: data.unsignedTx.to,
          data: data.unsignedTx.data,
          value: data.unsignedTx.value,
          gasLimit: data.unsignedTx.gasLimit
        });

        const confirmMessage: Message = {
          role: 'assistant',
          content: `Great! I've created your intent and it's now being processed. Transaction hash: ${tx.hash}\n\nI'll notify you when an agent picks up your intent and submits an execution plan.`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, confirmMessage]);

        // Track this intent
        setPendingIntents(prev => new Map(prev.set(data.intentId, { 
          status: IntentStatus.PENDING, 
          strategy 
        })));

        // Set up WebSocket listener for this intent
        setupIntentListener(data.intentId, strategy);
      }
    } catch (error) {
      console.error('Error creating intent:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, there was an error creating your intent. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const setupIntentListener = (intentId: number, strategy: Strategy) => {
    // This would connect to WebSocket and listen for intent status updates
    // For now, we'll simulate the flow
    
    // Simulate agent assignment after 5 seconds
    setTimeout(() => {
      setPendingIntents(prev => {
        const updated = new Map(prev);
        const intent = updated.get(intentId);
        if (intent) {
          intent.status = IntentStatus.ASSIGNED;
          updated.set(intentId, intent);
        }
        return updated;
      });

      const assignedMessage: Message = {
        role: 'assistant',
        content: `Good news! An AI agent has been assigned to your intent and is working on the execution plan.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assignedMessage]);

      // Simulate plan submission after another 3 seconds
      setTimeout(() => {
        setPendingIntents(prev => {
          const updated = new Map(prev);
          const intent = updated.get(intentId);
          if (intent) {
            intent.status = IntentStatus.PLAN_SUBMITTED;
            updated.set(intentId, intent);
          }
          return updated;
        });

        showExecutionPlan(intentId, strategy);
      }, 3000);
    }, 5000);
  };

  const showExecutionPlan = async (intentId: number, strategy: Strategy) => {
    try {
      // Fetch the pretty-printed execution plan
      const response = await fetch(`/api/intent/${intentId}/execution-plan`);
      const data = await response.json();
      
      const planMessage: Message = {
        role: 'assistant',
        content: `The agent has submitted an execution plan for your ${strategy.name} strategy:\n\n${data.prettyPrintedPlan}\n\nWould you like to approve this plan?`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, planMessage]);

      // Add approve/reject buttons
      const actionMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };
      
      // We'll add a custom component for plan approval
      setTimeout(() => {
        showPlanApprovalButtons(intentId, strategy);
      }, 1000);

    } catch (error) {
      console.error('Error fetching execution plan:', error);
    }
  };

  const showPlanApprovalButtons = (intentId: number, strategy: Strategy) => {
    const approvalMessage: Message = {
      role: 'assistant',
      content: `Please review the execution plan above.`,
      timestamp: Date.now(),
      planApproval: {
        intentId,
        strategyName: strategy.name
      }
    };
    setMessages(prev => [...prev, approvalMessage]);
  };

  const handleApprovePlan = async (intentId: number, strategy: Strategy) => {
    try {
      // Get unsigned approvePlan transaction
      const response = await fetch('/api/intent/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intentId,
          userId: address
        })
      });

      const data = await response.json();
      
      if (data.unsignedTx) {
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        
        const tx = await signer.sendTransaction({
          to: data.unsignedTx.to,
          data: data.unsignedTx.data,
          value: data.unsignedTx.value,
          gasLimit: data.unsignedTx.gasLimit
        });

        const approvedMessage: Message = {
          role: 'assistant',
          content: `Perfect! You've approved the execution plan. Transaction hash: ${tx.hash}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, approvedMessage]);

        // Update intent status
        setPendingIntents(prev => {
          const updated = new Map(prev);
          const intent = updated.get(intentId);
          if (intent) {
            intent.status = IntentStatus.APPROVED;
            updated.set(intentId, intent);
          }
          return updated;
        });

        // Show execute confirmation
        setTimeout(() => {
          showExecuteConfirmation(intentId, strategy);
        }, 2000);
      }
    } catch (error) {
      console.error('Error approving plan:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, there was an error approving the plan. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const showExecuteConfirmation = async (intentId: number, strategy: Strategy) => {
    // Get gas estimate for execution
    try {
      const response = await fetch(`/api/intent/${intentId}/gas-estimate`);
      const data = await response.json();
      
      const executeMessage: Message = {
        role: 'assistant',
        content: `Great! Your plan is approved.`,
        timestamp: Date.now(),
        executeConfirmation: {
          intentId,
          strategyName: strategy.name,
          estimatedGasUsd: data.estimatedGasUsd || strategy.estimatedGasUsd
        }
      };
      setMessages(prev => [...prev, executeMessage]);
      
    } catch (error) {
      console.error('Error getting gas estimate:', error);
      // Fallback to strategy gas estimate
      const executeMessage: Message = {
        role: 'assistant',
        content: `Great! Your plan is approved.`,
        timestamp: Date.now(),
        executeConfirmation: {
          intentId,
          strategyName: strategy.name,
          estimatedGasUsd: strategy.estimatedGasUsd
        }
      };
      setMessages(prev => [...prev, executeMessage]);
    }
  };

  const handleExecuteIntent = async (intentId: number, strategy: Strategy) => {
    try {
      // Get unsigned executeIntent transaction
      const response = await fetch('/api/intent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intentId,
          userId: address
        })
      });

      const data = await response.json();
      
      if (data.unsignedTx) {
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        
        const tx = await signer.sendTransaction({
          to: data.unsignedTx.to,
          data: data.unsignedTx.data,
          value: data.unsignedTx.value,
          gasLimit: data.unsignedTx.gasLimit
        });

        const executeMessage: Message = {
          role: 'assistant',
          content: `Excellent! Your strategy execution has started. Transaction hash: ${tx.hash}\n\nI'll track the progress for you.`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, executeMessage]);

        // Start execution tracking
        setExecutingIntentId(intentId);
        
        // Update intent status
        setPendingIntents(prev => {
          const updated = new Map(prev);
          const intent = updated.get(intentId);
          if (intent) {
            intent.status = IntentStatus.EXECUTING;
            updated.set(intentId, intent);
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('Error executing intent:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, there was an error executing the intent. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleRejectPlan = (intentId: number) => {
    const rejectMessage: Message = {
      role: 'assistant',
      content: `I understand you don't want to proceed with this execution plan. The intent has been cancelled. Would you like me to suggest alternative strategies?`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, rejectMessage]);
    
    // Remove from pending intents
    setPendingIntents(prev => {
      const updated = new Map(prev);
      updated.delete(intentId);
      return updated;
    });
  };

  const suggestedPrompts = [
    {
      text: "Get me yield on DOT",
      description: "Find the best yield opportunities"
    },
    {
      text: "What's the safest strategy?",
      description: "Low-risk yield options"
    },
    {
      text: "Show my portfolio",
      description: "View cross-chain balances"
    },
    {
      text: "Bridge DOT to Hydration",
      description: "Move tokens between chains"
    }
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {!isConnected ? (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-4">Welcome to NexusAI Protocol</h2>
              <p className="text-muted-foreground mb-6">
                Connect your wallet to start describing your DeFi goals in natural language.
              </p>
              <button
                onClick={connect}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Connect Wallet to Get Started
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <h2 className="text-xl font-semibold mb-4">What would you like to do?</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {suggestedPrompts.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => setMessage(prompt.text)}
                        className="p-4 bg-card border border-border rounded-lg hover:bg-accent text-left transition-colors"
                      >
                        <div className="font-medium">{prompt.text}</div>
                        <div className="text-sm text-muted-foreground">{prompt.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message History */}
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'} rounded-lg p-4`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    
                    {/* Strategy Cards */}
                    {msg.strategies && msg.strategies.length > 0 && (
                      <div className="mt-4 space-y-4">
                        {msg.strategies.map((strategy, strategyIndex) => (
                          <StrategyCard
                            key={strategyIndex}
                            strategy={strategy}
                            onApprove={() => handleStrategyApprove(strategy)}
                            onReject={() => handleStrategyReject(strategy)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Plan Approval */}
                    {msg.planApproval && (
                      <PlanApprovalMessage
                        intentId={msg.planApproval.intentId}
                        strategyName={msg.planApproval.strategyName}
                        onApprove={(intentId) => {
                          const strategy = pendingIntents.get(intentId)?.strategy;
                          if (strategy) handleApprovePlan(intentId, strategy);
                        }}
                        onReject={handleRejectPlan}
                      />
                    )}

                    {/* Execute Confirmation */}
                    {msg.executeConfirmation && (
                      <ExecuteConfirmationMessage
                        intentId={msg.executeConfirmation.intentId}
                        strategyName={msg.executeConfirmation.strategyName}
                        estimatedGasUsd={msg.executeConfirmation.estimatedGasUsd}
                        onExecute={(intentId) => {
                          const strategy = pendingIntents.get(intentId)?.strategy;
                          if (strategy) handleExecuteIntent(intentId, strategy);
                        }}
                      />
                    )}
                    
                    <div className="text-xs opacity-70 mt-2">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Execution Tracker */}
              {executingIntentId && address && (
                <ExecutionTracker 
                  intentId={executingIntentId}
                  userId={address}
                  onComplete={() => setExecutingIntentId(null)}
                  onError={(error) => {
                    console.error('Execution tracking error:', error);
                    // Could show a toast notification here
                  }}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      {isConnected && (
        <div className="border-t border-border bg-card p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your DeFi goal in natural language..."
                className="flex-1 px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[44px] max-h-32"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '44px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
              <button
                type="submit"
                disabled={!message.trim() || isLoading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </div>
          </form>
        </div>
      )}

      {/* Approval Dialog */}
      {selectedStrategy && (
        <ApprovalDialog
          strategy={selectedStrategy}
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          onConfirm={() => handleApprovalConfirm(selectedStrategy)}
        />
      )}
    </div>
  );
}