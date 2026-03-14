"use client";

import { CheckCircle, XCircle } from "lucide-react";

interface PlanApprovalMessageProps {
  intentId: number;
  strategyName: string;
  onApprove: (intentId: number) => void;
  onReject: (intentId: number) => void;
}

export function PlanApprovalMessage({ 
  intentId, 
  strategyName, 
  onApprove, 
  onReject 
}: PlanApprovalMessageProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 mt-3">
      <p className="text-sm mb-4">
        Do you want to approve the execution plan for your {strategyName} strategy?
      </p>
      
      <div className="flex gap-3">
        <button
          onClick={() => onApprove(intentId)}
          className="flex-1 bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Approve Plan
        </button>
        <button
          onClick={() => onReject(intentId)}
          className="flex-1 bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <XCircle className="h-4 w-4" />
          Reject Plan
        </button>
      </div>
    </div>
  );
}