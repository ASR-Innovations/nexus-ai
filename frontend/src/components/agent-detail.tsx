"use client";

import { useAgentDetail } from "@/hooks/use-agents";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

interface AgentDetailProps {
  address: string;
}

export function AgentDetail({ address }: AgentDetailProps) {
  const { data, isLoading, error } = useAgentDetail({ address });

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatStakeAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num === 0) return "0 PAS";
    if (num < 1) return `${num.toFixed(6)} PAS`;
    if (num < 1000) return `${num.toFixed(3)} PAS`;
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K PAS`;
    return `${(num / 1000000).toFixed(1)}M PAS`;
  };

  const getSuccessRate = (agent: any) => {
    if (agent.totalExecutions === 0) return 0;
    return (agent.successCount / agent.totalExecutions) * 100;
  };

  const getReputationPercentage = (score: number) => {
    return (score / 10000) * 100;
  };

  const getReputationColor = (score: number) => {
    const percentage = getReputationPercentage(score);
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    if (percentage >= 40) return "text-orange-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-muted rounded-lg"></div>
            <div className="h-64 bg-muted rounded-lg"></div>
            <div className="lg:col-span-3 h-64 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Agent Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The agent with address {formatAddress(address)} could not be found.
          </p>
          <Link 
            href="/agents" 
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Agents
          </Link>
        </div>
      </div>
    );
  }

  const { agent, recentExecutions } = data!;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/agents" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Agents
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Agent Details</h1>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground font-mono">{address}</p>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            agent.isActive 
              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          )}>
            {agent.isActive ? "Active" : "Inactive"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Stats */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className={cn("text-2xl font-bold", getReputationColor(agent.reputationScore))}>
                  {agent.reputationScore.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Reputation</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {getReputationPercentage(agent.reputationScore).toFixed(1)}%
                </div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{agent.totalExecutions}</div>
                <div className="text-sm text-muted-foreground">Total Executions</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {getSuccessRate(agent).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{formatStakeAmount(agent.stakeAmount)}</div>
                <div className="text-sm text-muted-foreground">Stake Amount</div>
              </div>
            </div>

            {/* Success/Failure Breakdown */}
            <div className="mt-6 pt-6 border-t border-border/50">
              <h3 className="font-semibold mb-3">Execution Breakdown</h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">
                    <span className="font-medium">{agent.successCount}</span> successful
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm">
                    <span className="font-medium">{agent.failCount}</span> failed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Info */}
        <div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Agent Info</h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Stake Amount</div>
                <div className="font-semibold">{formatStakeAmount(agent.stakeAmount)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className={cn(
                  "font-semibold",
                  agent.isActive ? "text-green-600" : "text-red-600"
                )}>
                  {agent.isActive ? "Active" : "Inactive"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Registered</div>
                <div className="font-semibold">
                  {new Date(agent.registeredAt * 1000).toLocaleDateString()}
                </div>
              </div>
              {agent.metadataUri && (
                <div>
                  <div className="text-sm text-muted-foreground">Metadata</div>
                  <a 
                    href={agent.metadataUri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm flex items-center gap-1"
                  >
                    View Profile <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Executions */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Executions</h2>
            {recentExecutions && recentExecutions.length > 0 ? (
              <div className="space-y-4">
                {recentExecutions.map((execution: any, index: number) => (
                  <div key={index} className="border border-border/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Intent #{execution.intentId}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(execution.createdAt * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        execution.status === 'COMPLETED' 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : execution.status === 'FAILED'
                          ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                      )}>
                        {execution.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No executions found for this agent
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}