'use client';

import { motion } from 'framer-motion';
import { User, TrendingUp, CheckCircle, XCircle, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: {
    address: string;
    name?: string;
    reputation: number;
    totalExecutions: number;
    successRate: number;
    specialties: string[];
    isActive: boolean;
  };
  className?: string;
}

// Truncate address to 0x1234...5678 format
const truncateAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Get color for reputation score
const getReputationColor = (reputation: number): string => {
  if (reputation >= 90) return 'text-light-success dark:text-dark-success';
  if (reputation >= 70) return 'text-light-primary dark:text-dark-primary';
  if (reputation >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-light-error dark:text-dark-error';
};

// Get specialty badge color
const getSpecialtyColor = (specialty: string): string => {
  const colors: Record<string, string> = {
    yield: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    liquidity: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    arbitrage: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    staking: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    lending: 'bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
  };
  return colors[specialty.toLowerCase()] || 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800';
};

export function AgentCard({ agent, className }: AgentCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/agents/${agent.address}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      onClick={handleClick}
      className={cn(
        'relative overflow-hidden rounded-2xl cursor-pointer',
        'bg-light-glassBackground dark:bg-dark-glassBackground',
        'backdrop-blur-xl',
        'border border-light-glassBorder dark:border-dark-glassBorder',
        'shadow-lg hover:shadow-xl',
        'transition-shadow duration-300',
        className
      )}
      role="article"
      aria-label={`Agent: ${agent.name || truncateAddress(agent.address)}`}
    >
      {/* Card Content */}
      <div className="p-6 space-y-4">
        {/* Header with Avatar and Status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-light-primary dark:text-dark-primary" aria-hidden="true" />
              </div>
              {/* Active Status Indicator */}
              <div
                className={cn(
                  'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-light-glassBackground dark:border-dark-glassBackground',
                  agent.isActive
                    ? 'bg-light-success dark:bg-dark-success'
                    : 'bg-gray-400 dark:bg-gray-600'
                )}
                role="status"
                aria-label={agent.isActive ? 'Active' : 'Inactive'}
              />
            </div>

            {/* Name and Address */}
            <div>
              <h3 className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
                {agent.name || 'Agent'}
              </h3>
              <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary font-mono">
                {truncateAddress(agent.address)}
              </p>
            </div>
          </div>

          {/* Reputation Score */}
          <div className="text-right">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-light-textTertiary dark:text-dark-textTertiary" aria-hidden="true" />
              <span className="text-xs text-light-textTertiary dark:text-dark-textTertiary">
                Reputation
              </span>
            </div>
            <p className={cn('text-2xl font-bold', getReputationColor(agent.reputation))}>
              {agent.reputation}
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Executions */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-light-textTertiary dark:text-dark-textTertiary">
              <Activity className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">Executions</span>
            </div>
            <p className="text-lg font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              {agent.totalExecutions.toLocaleString()}
            </p>
          </div>

          {/* Success Rate */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-light-textTertiary dark:text-dark-textTertiary">
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">Success Rate</span>
            </div>
            <p className="text-lg font-semibold text-light-success dark:text-dark-success">
              {agent.successRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Specialties */}
        {agent.specialties && agent.specialties.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-light-textSecondary dark:text-dark-textSecondary uppercase tracking-wide">
              Specialties
            </h4>
            <div className="flex flex-wrap gap-2">
              {agent.specialties.map((specialty, index) => (
                <span
                  key={index}
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border',
                    getSpecialtyColor(specialty)
                  )}
                  role="status"
                  aria-label={`Specialty: ${specialty}`}
                >
                  {specialty.charAt(0).toUpperCase() + specialty.slice(1)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status Text */}
        <div className="pt-2 border-t border-light-glassBorder dark:border-dark-glassBorder">
          <p className="text-xs text-light-textTertiary dark:text-dark-textTertiary">
            {agent.isActive ? 'Currently active and accepting intents' : 'Currently inactive'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
