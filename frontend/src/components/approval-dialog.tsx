"use client";

import { Strategy } from "@/types";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, TrendingUp, Shield, Clock, DollarSign, X } from "lucide-react";

interface ApprovalDialogProps {
  strategy: Strategy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ApprovalDialog({ strategy, open, onOpenChange, onConfirm }: ApprovalDialogProps) {
  const getRiskColor = (riskScore: number) => {
    if (riskScore <= 30) return "text-green-600";
    if (riskScore <= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const formatAPY = (apyBps: number) => {
    return (apyBps / 100).toFixed(2) + "%";
  };

  const formatLockPeriod = (days: number) => {
    if (days === 0) return "No lock period";
    if (days < 7) return `${days} day${days > 1 ? 's' : ''}`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''}`;
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''}`;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-xl font-semibold">
                  Confirm Strategy Approval
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="p-2 hover:bg-muted rounded-lg">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="p-6 space-y-6">
            {/* Strategy Overview */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">{strategy.name}</h3>
              <p className="text-muted-foreground mb-3">
                {strategy.protocol} on {strategy.chain}
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-600" />
                  <div className="font-semibold">{formatAPY(strategy.estimatedApyBps)}</div>
                  <div className="text-xs text-muted-foreground">Est. APY</div>
                </div>
                
                <div className="text-center">
                  <Shield className={`h-5 w-5 mx-auto mb-1 ${getRiskColor(strategy.riskScore)}`} />
                  <div className="font-semibold">{strategy.riskScore}</div>
                  <div className="text-xs text-muted-foreground">Risk Score</div>
                </div>
                
                <div className="text-center">
                  <Clock className="h-5 w-5 mx-auto mb-1" />
                  <div className="font-semibold">{formatLockPeriod(strategy.lockDays)}</div>
                  <div className="text-xs text-muted-foreground">Lock Period</div>
                </div>
                
                <div className="text-center">
                  <DollarSign className="h-5 w-5 mx-auto mb-1" />
                  <div className="font-semibold">${strategy.estimatedGasUsd.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Gas Cost</div>
                </div>
              </div>
            </div>

            {/* Risk Warnings */}
            {strategy.riskScore > 30 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-2">Risk Warning</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {strategy.riskScore > 60 && (
                        <li>• This is a high-risk strategy that could result in significant losses</li>
                      )}
                      {strategy.lockDays > 0 && (
                        <li>• Your funds will be locked for {formatLockPeriod(strategy.lockDays)}</li>
                      )}
                      {strategy.cons.map((con, index) => (
                        <li key={index}>• {con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Execution Plan Preview */}
            <div>
              <h4 className="font-medium mb-3">Execution Steps</h4>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  {strategy.executionPlan.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <div>
                        {step.destinationParaId === 0 ? (
                          <span>Execute on Polkadot Hub</span>
                        ) : (
                          <span>Send XCM to parachain {step.destinationParaId}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Final Confirmation */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-4">
                By confirming, you agree to execute this strategy. This will create an intent on-chain 
                and transfer your funds to the smart contract for execution.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Confirm & Execute
                </button>
              </div>
            </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}