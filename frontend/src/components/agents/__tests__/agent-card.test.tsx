import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { AgentCard } from '../agent-card';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, role, initial, animate, exit, whileHover, transition, ...props }: any) => (
      <div onClick={onClick} className={className} role={role} {...props}>
        {children}
      </div>
    ),
  },
}));

describe('AgentCard', () => {
  const mockPush = jest.fn();
  const mockAgent = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Test Agent',
    reputation: 95,
    totalExecutions: 150,
    successRate: 98.5,
    specialties: ['yield', 'liquidity'],
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  describe('Rendering', () => {
    it('should render agent name when provided', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('Test Agent')).toBeInTheDocument();
    });

    it('should render "Agent" as fallback when name is not provided', () => {
      const agentWithoutName = { ...mockAgent, name: undefined };
      render(<AgentCard agent={agentWithoutName} />);
      expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('should render truncated address in format 0x1234...5678', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('0x1234...5678')).toBeInTheDocument();
    });

    it('should render reputation score', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('95')).toBeInTheDocument();
      expect(screen.getByText('Reputation')).toBeInTheDocument();
    });

    it('should render total executions', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Executions')).toBeInTheDocument();
    });

    it('should render success rate with one decimal place', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('98.5%')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
    });

    it('should render all specialties as badges', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('Yield')).toBeInTheDocument();
      expect(screen.getByText('Liquidity')).toBeInTheDocument();
    });

    it('should capitalize specialty names', () => {
      const agentWithSpecialties = {
        ...mockAgent,
        specialties: ['arbitrage', 'staking', 'lending'],
      };
      render(<AgentCard agent={agentWithSpecialties} />);
      expect(screen.getByText('Arbitrage')).toBeInTheDocument();
      expect(screen.getByText('Staking')).toBeInTheDocument();
      expect(screen.getByText('Lending')).toBeInTheDocument();
    });

    it('should not render specialties section when empty', () => {
      const agentWithoutSpecialties = { ...mockAgent, specialties: [] };
      render(<AgentCard agent={agentWithoutSpecialties} />);
      expect(screen.queryByText('Specialties')).not.toBeInTheDocument();
    });

    it('should show active status text when agent is active', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('Currently active and accepting intents')).toBeInTheDocument();
    });

    it('should show inactive status text when agent is inactive', () => {
      const inactiveAgent = { ...mockAgent, isActive: false };
      render(<AgentCard agent={inactiveAgent} />);
      expect(screen.getByText('Currently inactive')).toBeInTheDocument();
    });

    it('should render active status indicator with correct aria-label', () => {
      render(<AgentCard agent={mockAgent} />);
      const statusIndicator = screen.getByRole('status', { name: 'Active' });
      expect(statusIndicator).toBeInTheDocument();
    });

    it('should render inactive status indicator with correct aria-label', () => {
      const inactiveAgent = { ...mockAgent, isActive: false };
      render(<AgentCard agent={inactiveAgent} />);
      const statusIndicator = screen.getByRole('status', { name: 'Inactive' });
      expect(statusIndicator).toBeInTheDocument();
    });

    it('should format large execution numbers with commas', () => {
      const agentWithManyExecutions = { ...mockAgent, totalExecutions: 1234567 };
      render(<AgentCard agent={agentWithManyExecutions} />);
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to agent detail page when clicked', () => {
      render(<AgentCard agent={mockAgent} />);
      const card = screen.getByRole('article');
      fireEvent.click(card);
      expect(mockPush).toHaveBeenCalledWith('/agents/0x1234567890abcdef1234567890abcdef12345678');
    });

    it('should have cursor-pointer class for clickable indication', () => {
      render(<AgentCard agent={mockAgent} />);
      const card = screen.getByRole('article');
      expect(card).toHaveClass('cursor-pointer');
    });
  });

  describe('Styling', () => {
    it('should apply glass morphism classes', () => {
      render(<AgentCard agent={mockAgent} />);
      const card = screen.getByRole('article');
      expect(card).toHaveClass('bg-light-glassBackground');
      expect(card).toHaveClass('backdrop-blur-xl');
      expect(card).toHaveClass('border-light-glassBorder');
    });

    it('should apply custom className when provided', () => {
      render(<AgentCard agent={mockAgent} className="custom-class" />);
      const card = screen.getByRole('article');
      expect(card).toHaveClass('custom-class');
    });

    it('should have rounded corners', () => {
      render(<AgentCard agent={mockAgent} />);
      const card = screen.getByRole('article');
      expect(card).toHaveClass('rounded-2xl');
    });

    it('should have shadow classes', () => {
      render(<AgentCard agent={mockAgent} />);
      const card = screen.getByRole('article');
      expect(card).toHaveClass('shadow-lg');
      expect(card).toHaveClass('hover:shadow-xl');
    });
  });

  describe('Reputation Color Coding', () => {
    it('should use success color for reputation >= 90', () => {
      render(<AgentCard agent={{ ...mockAgent, reputation: 95 }} />);
      const reputationScore = screen.getByText('95');
      expect(reputationScore).toHaveClass('text-light-success');
    });

    it('should use primary color for reputation >= 70 and < 90', () => {
      render(<AgentCard agent={{ ...mockAgent, reputation: 75 }} />);
      const reputationScore = screen.getByText('75');
      expect(reputationScore).toHaveClass('text-light-primary');
    });

    it('should use yellow color for reputation >= 50 and < 70', () => {
      render(<AgentCard agent={{ ...mockAgent, reputation: 60 }} />);
      const reputationScore = screen.getByText('60');
      expect(reputationScore).toHaveClass('text-yellow-600');
    });

    it('should use error color for reputation < 50', () => {
      render(<AgentCard agent={{ ...mockAgent, reputation: 40 }} />);
      const reputationScore = screen.getByText('40');
      expect(reputationScore).toHaveClass('text-light-error');
    });
  });

  describe('Specialty Badge Colors', () => {
    it('should apply green color for yield specialty', () => {
      render(<AgentCard agent={{ ...mockAgent, specialties: ['yield'] }} />);
      const badge = screen.getByText('Yield');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-700');
    });

    it('should apply blue color for liquidity specialty', () => {
      render(<AgentCard agent={{ ...mockAgent, specialties: ['liquidity'] }} />);
      const badge = screen.getByText('Liquidity');
      expect(badge).toHaveClass('bg-blue-100');
      expect(badge).toHaveClass('text-blue-700');
    });

    it('should apply purple color for arbitrage specialty', () => {
      render(<AgentCard agent={{ ...mockAgent, specialties: ['arbitrage'] }} />);
      const badge = screen.getByText('Arbitrage');
      expect(badge).toHaveClass('bg-purple-100');
      expect(badge).toHaveClass('text-purple-700');
    });

    it('should apply orange color for staking specialty', () => {
      render(<AgentCard agent={{ ...mockAgent, specialties: ['staking'] }} />);
      const badge = screen.getByText('Staking');
      expect(badge).toHaveClass('bg-orange-100');
      expect(badge).toHaveClass('text-orange-700');
    });

    it('should apply pink color for lending specialty', () => {
      render(<AgentCard agent={{ ...mockAgent, specialties: ['lending'] }} />);
      const badge = screen.getByText('Lending');
      expect(badge).toHaveClass('bg-pink-100');
      expect(badge).toHaveClass('text-pink-700');
    });

    it('should apply gray color for unknown specialty', () => {
      render(<AgentCard agent={{ ...mockAgent, specialties: ['unknown'] }} />);
      const badge = screen.getByText('Unknown');
      expect(badge).toHaveClass('bg-gray-100');
      expect(badge).toHaveClass('text-gray-700');
    });
  });

  describe('Accessibility', () => {
    it('should have article role', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should have descriptive aria-label with agent name', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Agent: Test Agent');
    });

    it('should have descriptive aria-label with address when name is missing', () => {
      const agentWithoutName = { ...mockAgent, name: undefined };
      render(<AgentCard agent={agentWithoutName} />);
      expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Agent: 0x1234...5678');
    });

    it('should mark icons as aria-hidden', () => {
      const { container } = render(<AgentCard agent={mockAgent} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have status role for active indicator', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByRole('status', { name: 'Active' })).toBeInTheDocument();
    });

    it('should have status role for specialty badges', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByRole('status', { name: 'Specialty: yield' })).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Specialty: liquidity' })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle address shorter than 10 characters', () => {
      const shortAddress = { ...mockAgent, address: '0x123' };
      render(<AgentCard agent={shortAddress} />);
      expect(screen.getByText('0x123')).toBeInTheDocument();
    });

    it('should handle zero executions', () => {
      const newAgent = { ...mockAgent, totalExecutions: 0 };
      render(<AgentCard agent={newAgent} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle 100% success rate', () => {
      const perfectAgent = { ...mockAgent, successRate: 100 };
      render(<AgentCard agent={perfectAgent} />);
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('should handle 0% success rate', () => {
      const failedAgent = { ...mockAgent, successRate: 0 };
      render(<AgentCard agent={failedAgent} />);
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('should handle empty specialties array', () => {
      const agentNoSpecialties = { ...mockAgent, specialties: [] };
      render(<AgentCard agent={agentNoSpecialties} />);
      expect(screen.queryByText('Specialties')).not.toBeInTheDocument();
    });

    it('should handle undefined specialties', () => {
      const agentUndefinedSpecialties = { ...mockAgent, specialties: undefined as any };
      render(<AgentCard agent={agentUndefinedSpecialties} />);
      expect(screen.queryByText('Specialties')).not.toBeInTheDocument();
    });
  });
});
