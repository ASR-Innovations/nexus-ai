"use client";

import { Play, DollarSign } from "lucide-react";

interface ExecuteConfirmationMessageProps {
  intentId: number;
  strategyName: string;
  estimatedGasUsd: number;
  onExecute: (intentId: number) => void;
}

export function ExecuteConfirmationMessage({ 
  intentId, 
  strategyName, 
  estimatedGasUsd,
  onExecute 
}: ExecuteConfirmationMessageProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <Play className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h4 className="font-medium text-blue-900 mb-1">Ready to Execute</h4>
          <p className="text-sm text-blue-700">
            Your {strategyName} strategy is approved and ready for execution.
          </p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Estimated gas cost:
          </span>
          <span className="font-semibold">${estimatedGasUsd.toFixed(2)}</span>
        </div>
      </div>
      
      <button
        onClick={() => onExecute(intentId)}
        className="w-full bg-blue-600 text-white hover:bg-blue-700 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        <Play className="h-4 w-4" />
        Execute Strategy
      </button>
    </div>
  );
}