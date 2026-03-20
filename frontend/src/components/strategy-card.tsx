"use client";

import { Strategy } from "@/types";
import { CheckCircle, XCircle, Clock, Shield, TrendingUp, AlertTriangle } from "lucide-react";

interface StrategyCardProps {
  strategy: Strategy;
  onApprove: () => void;
  onReject: () => void;
}

export function StrategyCard({ strategy, onApprove, onReject }: StrategyCardProps) {
  const resolvedApy = strategy.apy ?? (strategy.estimatedApyBps != null ? strategy.estimatedApyBps / 100 : 0);
  const resolvedRisk = strategy.risk ?? strategy.riskLevel ?? 'medium';
  const resolvedLockPeriod = strategy.lockPeriod ?? strategy.lockDays ?? 0;
  const resolvedNetApy = strategy.netApy ?? (strategy.netApyBps != null ? strategy.netApyBps / 100 : resolvedApy);

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    if (risk === 'low') return "text-green-600 bg-green-100";
    if (risk === 'medium') return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getRiskLabel = (risk: 'low' | 'medium' | 'high') => {
    if (risk === 'low') return "Low Risk";
    if (risk === 'medium') return "Medium Risk";
    return "High Risk";
  };

  const formatAPY = (apy: number) => {
    return apy.toFixed(2) + "%";
  };

  const formatLockPeriod = (days: number) => {
    if (days === 0) return "No lock";
    if (days < 7) return `${days} day${days > 1 ? 's' : ''}`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''}`;
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''}`;
  };

  return (
    <div className="bg-background border border-border rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{strategy.name}</h3>
          <p className="text-sm text-muted-foreground">
            {strategy.protocol} on {strategy.chain}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(resolvedRisk)}`}>
          {getRiskLabel(resolvedRisk)}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-lg font-semibold">{formatAPY(resolvedApy)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Est. APY</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Shield className="h-4 w-4" />
            <span className="text-lg font-semibold">{resolvedRisk.charAt(0).toUpperCase() + resolvedRisk.slice(1)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Risk Level</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-lg font-semibold">{formatLockPeriod(resolvedLockPeriod)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Lock Period</p>
        </div>
      </div>

      {/* Net APY and Gas Cost */}
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="flex justify-between items-center text-sm">
          <span>Net APY (after costs):</span>
          <span className="font-semibold text-green-600">{formatAPY(resolvedNetApy)}</span>
        </div>
        <div className="flex justify-between items-center text-sm mt-1">
          <span>Estimated gas cost:</span>
          <span className="font-semibold">${strategy.estimatedGasUsd.toFixed(2)}</span>
        </div>
      </div>

      {/* Pros and Cons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            Pros
          </h4>
          <ul className="text-sm space-y-1">
            {strategy.pros.map((pro, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Cons
          </h4>
          <ul className="text-sm space-y-1">
            {strategy.cons.map((con, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Explanation */}
      {strategy.explanation && (
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">{strategy.explanation}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onApprove}
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Approve Strategy
        </button>
        <button
          onClick={onReject}
          className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </button>
      </div>
    </div>
  );
}