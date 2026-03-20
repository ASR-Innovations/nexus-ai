"use client";

import { useState } from "react";
import { useAgents, AgentSortBy } from "@/hooks/use-agents";
import { AgentCard } from "@/components/agent-card";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

export function AgentLeaderboard() {
  const [sortBy, setSortBy] = useState<AgentSortBy>('reputation');
  const [currentPage, setCurrentPage] = useState(0);
  const limit = 12; // Show 12 agents per page

  const { data, isLoading, error } = useAgents({
    sort: sortBy,
    limit,
    offset: currentPage * limit,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const handleSortChange = (newSort: AgentSortBy) => {
    setSortBy(newSort);
    setCurrentPage(0); // Reset to first page when sorting changes
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getSortLabel = (sort: AgentSortBy) => {
    switch (sort) {
      case 'reputation': return 'Reputation';
      case 'volume': return 'Volume';
      case 'success_rate': return 'Success Rate';
      default: return 'Reputation';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Agent Leaderboard</h1>
        <p className="text-muted-foreground">
          Discover the top-performing AI agents in the NexusAI ecosystem
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">
                {data ? `${data.total} Agents` : 'Loading...'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <select 
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as AgentSortBy)}
                  className="px-3 py-1 bg-input border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="reputation">Reputation</option>
                  <option value="volume">Volume</option>
                  <option value="success_rate">Success Rate</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-muted rounded-lg h-64"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-2">Failed to load agents</div>
              <p className="text-muted-foreground text-sm">
                Please try again later or check your connection
              </p>
            </div>
          ) : !data || data.agents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No agents found</h3>
              <p className="text-sm">
                {sortBy === 'reputation' 
                  ? "No agents registered yet. Be the first to register as an agent!"
                  : `No agents found when sorting by ${getSortLabel(sortBy).toLowerCase()}`
                }
              </p>
            </div>
          ) : (
            <>
              {/* Agent Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {data.agents.map((agent) => (
                  <AgentCard key={agent.address} agent={agent} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t border-border/50">
                  <div className="text-sm text-muted-foreground">
                    Showing {currentPage * limit + 1} to {Math.min((currentPage + 1) * limit, data.total)} of {data.total} agents
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 0}
                      className="flex items-center gap-1 px-3 py-1 text-sm border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i;
                        } else if (currentPage < 3) {
                          pageNum = i;
                        } else if (currentPage > totalPages - 4) {
                          pageNum = totalPages - 5 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`w-8 h-8 text-sm rounded transition-colors ${
                              currentPage === pageNum
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            {pageNum + 1}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages - 1}
                      className="flex items-center gap-1 px-3 py-1 text-sm border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}