"use client";

import { YieldPosition as YieldPositionType } from "@/types";
import { cn } from "@/lib/utils";
import { TrendingUp, Clock, ExternalLink } from "lucide-react";

interface YieldPositionProps {
  positions: YieldPositionType[];
  className?: string;
}

export function YieldPosition({ positions, className }: YieldPositionProps) {
  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num === 0) return "0";
    if (num < 0.001) return "< 0.001";
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(3);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatApy = (apyBps: number) => {
    return (apyBps / 100).toFixed(2);
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp * 1000; // Convert to milliseconds
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const calculateYieldGain = (deposited: string, current: string) => {
    const depositedNum = parseFloat(deposited);
    const currentNum = parseFloat(current);
    const gain = currentNum - depositedNum;
    const gainPercent = depositedNum > 0 ? (gain / depositedNum) * 100 : 0;
    
    return {
      absolute: gain,
      percentage: gainPercent,
      isPositive: gain >= 0,
    };
  };

  if (positions.length === 0) {
    return (
      <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
        <h2 className="text-lg font-semibold mb-4">Active Yields</h2>
        <div className="text-center py-8 text-muted-foreground">
          No active yield positions
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
      <h2 className="text-lg font-semibold mb-4">Active Yields</h2>
      <div className="space-y-4">
        {positions.map((position) => {
          const yieldGain = calculateYieldGain(position.depositedAmount, position.currentValue);
          
          return (
            <div key={position.intentId} className="border border-border/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{position.protocol}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <span>{position.chain}</span>
                      <span>•</span>
                      <span>{position.asset}</span>
                    </p>
                  </div>
                </div>
                <button className="p-1 hover:bg-muted rounded">
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Deposited</p>
                  <p className="font-semibold">
                    {formatAmount(position.depositedAmount)} {position.asset}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Value</p>
                  <p className="font-semibold">
                    {formatAmount(position.currentValue)} {position.asset}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">APY</p>
                  <p className="font-semibold text-green-600">
                    {formatApy(position.apyBps)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Accrued</p>
                  <p className={cn(
                    "font-semibold",
                    yieldGain.isPositive ? "text-green-600" : "text-red-600"
                  )}>
                    {yieldGain.isPositive ? "+" : ""}{formatAmount(yieldGain.absolute.toString())} {position.asset}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/30">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Started {formatTimeAgo(position.startedAt)}</span>
                </div>
                <div className="text-sm">
                  <span className={cn(
                    "font-medium",
                    yieldGain.isPositive ? "text-green-600" : "text-red-600"
                  )}>
                    {yieldGain.isPositive ? "+" : ""}{yieldGain.percentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}