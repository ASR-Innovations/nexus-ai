"use client";

import { Agent } from "@/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface AgentCardProps {
  agent: Agent;
  className?: string;
}

export function AgentCard({ agent, className }: AgentCardProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatStakeAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num === 0) return "0 DOT";
    if (num < 1) return `${num.toFixed(6)} DOT`;
    if (num < 1000) return `${num.toFixed(3)} DOT`;
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K DOT`;
    return `${(num / 1000000).toFixed(1)}M DOT`;
  };

  const getSuccessRate = () => {
    if (agent.totalExecutions === 0) return 0;
    return (agent.successCount / agent.totalExecutions) * 100;
  };

  const getReputationPercentage = () => {
    return (agent.reputationScore / 10000) * 100;
  };

  const getReputationColor = () => {
    const percentage = getReputationPercentage();
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 60) return "bg-yellow-500";
    if (percentage >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  const getStatusColor = () => {
    return agent.isActive ? "bg-green-500" : "bg-red-500";
  };

  return (
    <Link href={`/agents/${agent.address}`}>
      <div className={cn(
        "bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer",
        className
      )}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {agent.address.slice(2, 4).toUpperCase()}
                </span>
              </div>
              {/* Status indicator */}
              <div className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background",
                getStatusColor()
              )} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{formatAddress(agent.address)}</h3>
              <p className="text-sm text-muted-foreground">
                {agent.isActive ? "Active Agent" : "Inactive Agent"}
              </p>
            </div>
          </div>
        </div>

        {/* Reputation Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Reputation</span>
            <span className="text-sm text-muted-foreground">
              {agent.reputationScore.toLocaleString()} / 10,000
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn("h-2 rounded-full transition-all", getReputationColor())}
              style={{ width: `${getReputationPercentage()}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{formatStakeAmount(agent.stakeAmount)}</p>
            <p className="text-sm text-muted-foreground">Stake</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{getSuccessRate().toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Success Rate</p>
          </div>
        </div>

        {/* Execution Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="font-medium text-green-600">{agent.successCount}</span>
              <span className="text-muted-foreground ml-1">success</span>
            </div>
            <div>
              <span className="font-medium text-red-600">{agent.failCount}</span>
              <span className="text-muted-foreground ml-1">failed</span>
            </div>
          </div>
          <div>
            <span className="font-medium">{agent.totalExecutions}</span>
            <span className="text-muted-foreground ml-1">total</span>
          </div>
        </div>

        {/* Registration Date */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Registered {new Date(agent.registeredAt * 1000).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Link>
  );
}