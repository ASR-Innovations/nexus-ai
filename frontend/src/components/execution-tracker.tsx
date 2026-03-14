"use client";

import { useEffect, useMemo } from "react";
import { ExecutionUpdate, IntentStatus } from "@/types";
import { CheckCircle, Clock, ArrowRight, AlertCircle, ExternalLink, Wifi, WifiOff } from "lucide-react";
import { useExecutionTracking } from "@/hooks/use-execution-tracking";

interface ExecutionTrackerProps {
  intentId: number;
  userId: string;
  onComplete: () => void;
  onError?: (error: Error) => void;
}

export function ExecutionTracker({ intentId, userId, onComplete, onError }: ExecutionTrackerProps) {
  const { updates, isConnected, isConnecting, error, lastUpdate } = useExecutionTracking({
    intentId,
    userId,
    onUpdate: (update) => {
      console.log('Execution update received:', update);
    },
    onError
  });

  const currentStatus = useMemo(() => {
    return lastUpdate?.status || 'PENDING';
  }, [lastUpdate]);

  const steps = [
    { key: 'PENDING', label: 'Depositing', description: 'Creating intent on-chain' },
    { key: 'ASSIGNED', label: 'Agent Assigned', description: 'AI agent claimed your intent' },
    { key: 'PLAN_SUBMITTED', label: 'Plan Ready', description: 'Execution plan submitted' },
    { key: 'APPROVED', label: 'Plan Approved', description: 'You approved the execution plan' },
    { key: 'EXECUTING', label: 'Building XCM', description: 'Preparing cross-chain messages' },
    { key: 'AWAITING_CONFIRMATION', label: 'Sending Cross-Chain', description: 'XCM messages dispatched' },
    { key: 'COMPLETED', label: 'Complete', description: 'Strategy executed successfully' }
  ];

  // Handle completion and failure
  useEffect(() => {
    if (lastUpdate?.type === 'execution_complete' || lastUpdate?.type === 'execution_failed') {
      const timer = setTimeout(() => {
        onComplete();
      }, 3000); // Show completion for 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [lastUpdate, onComplete]);

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.key === currentStatus);
  };

  const getStepStatus = (stepIndex: number) => {
    const currentIndex = getCurrentStepIndex();
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getTransactionUrl = (txHash: string) => {
    // This should be configurable based on the network
    return `https://polkadot-hub.subscan.io/extrinsic/${txHash}`;
  };

  const getChainName = (paraId: number) => {
    const chainMap: Record<number, string> = {
      0: 'Polkadot Hub',
      2034: 'Hydration',
      2030: 'Bifrost',
      2004: 'Moonbeam'
    };
    return chainMap[paraId] || `Parachain ${paraId}`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Execution Progress</h3>
        
        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          {isConnecting ? (
            <>
              <Clock className="h-4 w-4 animate-pulse text-yellow-500" />
              <span className="text-muted-foreground">Connecting...</span>
            </>
          ) : isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-red-600">Disconnected</span>
            </>
          )}
        </div>
      </div>

      {/* Connection Error */}
      {error && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              Connection issue: {error}. Updates may be delayed.
            </span>
          </div>
        </div>
      )}
      
      {/* Progress Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.key} className="flex items-start gap-4">
              {/* Step Icon */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  status === 'completed' 
                    ? 'bg-green-100 text-green-600' 
                    : status === 'current'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {status === 'completed' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : status === 'current' ? (
                    <Clock className="h-4 w-4 animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 bg-current rounded-full" />
                  )}
                </div>
                
                {!isLast && (
                  <div className={`w-0.5 h-8 mt-2 ${
                    status === 'completed' ? 'bg-green-200' : 'bg-muted'
                  }`} />
                )}
              </div>
              
              {/* Step Content */}
              <div className="flex-1 pb-8">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`font-medium ${
                    status === 'completed' ? 'text-green-600' : 
                    status === 'current' ? 'text-blue-600' : 
                    'text-muted-foreground'
                  }`}>
                    {step.label}
                  </h4>
                  
                  {status === 'current' && (
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground">{step.description}</p>
                
                {/* Show relevant updates for this step */}
                {updates
                  .filter(update => update.status === step.key || 
                    (step.key === 'AWAITING_CONFIRMATION' && update.type === 'xcm_sent'))
                  .map((update, updateIndex) => (
                    <div key={updateIndex} className="mt-2 p-2 bg-muted/30 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span>{formatTimestamp(update.timestamp)}</span>
                        {update.txHash && (
                          <a
                            href={getTransactionUrl(update.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            View Tx <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      
                      {update.type === 'xcm_sent' && update.paraId && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-blue-600 font-medium">
                            {getChainName(0)}
                          </span>
                          <div className="flex items-center">
                            <ArrowRight className="h-3 w-3 text-blue-500 animate-pulse" />
                          </div>
                          <span className="text-green-600 font-medium">
                            {getChainName(update.paraId)}
                          </span>
                        </div>
                      )}
                      
                      {update.currentStep && update.totalSteps && (
                        <div className="mt-1">
                          Step {update.currentStep} of {update.totalSteps}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Error Display */}
      {updates.some(update => update.type === 'execution_failed') && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-red-800 mb-2">Execution Failed</h4>
              <p className="text-sm text-red-700 mb-3">
                {updates.find(update => update.type === 'execution_failed')?.error || 
                 'The strategy execution encountered an error. Your funds have been refunded to your wallet.'}
              </p>
              
              {/* Actionable guidance */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-red-800">What you can do:</h5>
                <ul className="text-sm text-red-700 space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Check your wallet for the refunded amount</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Try creating a new intent with different parameters</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Consider reducing the amount or adjusting risk tolerance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Contact support if the issue persists</span>
                  </li>
                </ul>
              </div>
              
              {/* Show specific error details if available */}
              {updates.find(update => update.type === 'execution_failed')?.error && (
                <details className="mt-3">
                  <summary className="text-sm font-medium text-red-800 cursor-pointer hover:text-red-900">
                    Technical Details
                  </summary>
                  <div className="mt-2 p-2 bg-red-100 rounded text-xs font-mono text-red-800">
                    {updates.find(update => update.type === 'execution_failed')?.error}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Network/Connection Errors */}
      {error && !isConnected && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <WifiOff className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800 mb-2">Connection Issue</h4>
              <p className="text-sm text-yellow-700 mb-3">
                Unable to receive real-time updates. Your execution may still be in progress.
              </p>
              
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-yellow-800">Troubleshooting:</h5>
                <ul className="text-sm text-yellow-700 space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Check your internet connection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Refresh the page to reconnect</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Check your portfolio for execution results</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Display */}
      {updates.some(update => update.type === 'execution_complete') && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-800 mb-1">Execution Complete!</h4>
              <p className="text-sm text-green-700">
                Your strategy has been executed successfully. 
                {updates.find(update => update.type === 'execution_complete')?.returnAmount && (
                  <span> Return amount: {updates.find(update => update.type === 'execution_complete')?.returnAmount} DOT</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}