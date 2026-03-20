/**
 * Visual Test Component for AgentCard
 * 
 * This file demonstrates various states of the AgentCard component.
 * It can be used for manual visual testing and as a reference for component usage.
 * 
 * To use: Import this component in a page and render it.
 */

import { AgentCard } from '../agent-card';

export function AgentCardVisualTest() {
  const activeAgent = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Yield Optimizer Pro',
    reputation: 95,
    totalExecutions: 1250,
    successRate: 98.5,
    specialties: ['yield', 'liquidity'],
    isActive: true,
  };

  const inactiveAgent = {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: 'Arbitrage Bot',
    reputation: 72,
    totalExecutions: 450,
    successRate: 85.3,
    specialties: ['arbitrage', 'staking'],
    isActive: false,
  };

  const lowReputationAgent = {
    address: '0x9876543210fedcba9876543210fedcba98765432',
    name: 'New Agent',
    reputation: 45,
    totalExecutions: 50,
    successRate: 60.0,
    specialties: ['lending'],
    isActive: true,
  };

  const agentWithoutName = {
    address: '0xfedcba9876543210fedcba9876543210fedcba98',
    reputation: 88,
    totalExecutions: 890,
    successRate: 92.1,
    specialties: ['yield', 'staking', 'liquidity'],
    isActive: true,
  };

  const agentWithManySpecialties = {
    address: '0x1111222233334444555566667777888899990000',
    name: 'Multi-Strategy Agent',
    reputation: 91,
    totalExecutions: 2100,
    successRate: 94.7,
    specialties: ['yield', 'liquidity', 'arbitrage', 'staking', 'lending'],
    isActive: true,
  };

  return (
    <div className="p-8 space-y-8 bg-light-background dark:bg-dark-background min-h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-light-textPrimary dark:text-dark-textPrimary">
          AgentCard Visual Tests
        </h1>
        <p className="text-light-textSecondary dark:text-dark-textSecondary mb-8">
          Various states and configurations of the AgentCard component
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4 text-light-textPrimary dark:text-dark-textPrimary">
            Active Agent (High Reputation)
          </h2>
          <AgentCard agent={activeAgent} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 text-light-textPrimary dark:text-dark-textPrimary">
            Inactive Agent (Medium Reputation)
          </h2>
          <AgentCard agent={inactiveAgent} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 text-light-textPrimary dark:text-dark-textPrimary">
            Low Reputation Agent
          </h2>
          <AgentCard agent={lowReputationAgent} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 text-light-textPrimary dark:text-dark-textPrimary">
            Agent Without Name
          </h2>
          <AgentCard agent={agentWithoutName} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 text-light-textPrimary dark:text-dark-textPrimary">
            Agent With Many Specialties
          </h2>
          <AgentCard agent={agentWithManySpecialties} />
        </div>
      </div>
    </div>
  );
}
