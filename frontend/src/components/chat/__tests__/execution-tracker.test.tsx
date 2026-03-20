import { render, screen, waitFor, act } from '@testing-library/react';
import { ExecutionTracker } from '../execution-tracker';
import { getChatService } from '@/services/chat.service';
import type { ExecutionStatusResponse } from '@/types/api.types';

// Mock the chat service
jest.mock('@/services/chat.service');

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    a: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ExecutionTracker', () => {
  const mockGetExecutionStatus = jest.fn();
  const mockOnComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (getChatService as jest.Mock).mockReturnValue({
      getExecutionStatus: mockGetExecutionStatus,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const mockExecutionResponse: ExecutionStatusResponse = {
    execution: {
      intent_id: 123,
      status: 'in_progress',
      total_steps: 3,
      completed_steps: 1,
      started_at: 1710864500,
      completed_at: null,
      error_message: null,
    },
    steps: [
      {
        id: 1,
        intent_id: 123,
        step_index: 0,
        destination_para_id: 2034,
        target_contract: '0xHydrationPool123456789',
        status: 'completed',
        tx_hash: '0xabc123def456',
        executed_at: 1710864520,
      },
      {
        id: 2,
        intent_id: 123,
        step_index: 1,
        destination_para_id: 2030,
        target_contract: '0xBifrostPool987654321',
        status: 'in_progress',
        tx_hash: null,
        executed_at: null,
      },
      {
        id: 3,
        intent_id: 123,
        step_index: 2,
        destination_para_id: 2004,
        target_contract: '0xMoonbeamPool111222333',
        status: 'pending',
        tx_hash: null,
        executed_at: null,
      },
    ],
    xcmMessages: [
      {
        id: 1,
        intent_id: 123,
        para_id: 2034,
        xcm_message_hash: '0xdef456abc789',
        status: 'confirmed',
        dispatched_at: 1710864510,
        confirmed_at: 1710864520,
      },
    ],
  };

  describe('Initial Rendering', () => {
    it('should render execution tracker with loading state initially', () => {
      mockGetExecutionStatus.mockImplementation(() => new Promise(() => {}));

      render(<ExecutionTracker intentId={123} />);

      expect(screen.getByText('Execution Progress')).toBeInTheDocument();
      expect(screen.getByText('Loading execution status...')).toBeInTheDocument();
    });

    it('should fetch execution status immediately on mount', () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      expect(mockGetExecutionStatus).toHaveBeenCalledWith(123);
      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Progress Display', () => {
    it('should display progress bar with correct percentage', async () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('1 of 3 steps completed')).toBeInTheDocument();
        expect(screen.getByText('33%')).toBeInTheDocument();
      });
    });

    it('should display 100% progress when all steps completed', async () => {
      const completedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'completed',
          completed_steps: 3,
          completed_at: 1710864600,
        },
        steps: mockExecutionResponse.steps.map((step) => ({
          ...step,
          status: 'completed',
          tx_hash: '0xabc123',
          executed_at: 1710864520,
        })),
      };

      mockGetExecutionStatus.mockResolvedValue(completedResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('3 of 3 steps completed')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });
  });

  describe('Execution Steps Display', () => {
    it('should display all execution steps with correct status', async () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Step 1: Hydration')).toBeInTheDocument();
        expect(screen.getByText('Step 2: Bifrost')).toBeInTheDocument();
        expect(screen.getByText('Step 3: Moonbeam')).toBeInTheDocument();
      });
    });

    it('should display transaction hash link for completed steps', async () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        const txLinks = screen.getAllByText('View Transaction');
        expect(txLinks).toHaveLength(1);
        expect(txLinks[0].closest('a')).toHaveAttribute(
          'href',
          'https://hydration.subscan.io/extrinsic/0xabc123def456'
        );
      });
    });

    it('should display error message for failed steps', async () => {
      const failedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        steps: [
          {
            ...mockExecutionResponse.steps[0],
            status: 'failed',
            error: 'Insufficient liquidity',
          },
          ...mockExecutionResponse.steps.slice(1),
        ],
      };

      mockGetExecutionStatus.mockResolvedValue(failedResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Insufficient liquidity')).toBeInTheDocument();
      });
    });

    it('should display target contract address', async () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        // The text is split across multiple elements, so we check for the code element
        const codeElements = screen.getAllByText(/0xHydratio/);
        expect(codeElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('XCM Messages Display', () => {
    it('should display XCM messages section when messages exist', async () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Cross-Chain Messages')).toBeInTheDocument();
        expect(screen.getByText('XCM to Hydration')).toBeInTheDocument();
        expect(screen.getByText('confirmed')).toBeInTheDocument();
      });
    });

    it('should not display XCM section when no messages exist', async () => {
      const noXcmResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        xcmMessages: [],
      };

      mockGetExecutionStatus.mockResolvedValue(noXcmResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.queryByText('Cross-Chain Messages')).not.toBeInTheDocument();
      });
    });

    it('should display XCM message status with correct styling', async () => {
      const xcmResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        xcmMessages: [
          {
            id: 1,
            intent_id: 123,
            para_id: 2034,
            xcm_message_hash: '0xabc123',
            status: 'pending',
            dispatched_at: null,
            confirmed_at: null,
          },
          {
            id: 2,
            intent_id: 123,
            para_id: 2030,
            xcm_message_hash: '0xdef456',
            status: 'dispatched',
            dispatched_at: 1710864510,
            confirmed_at: null,
          },
        ],
      };

      mockGetExecutionStatus.mockResolvedValue(xcmResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('pending')).toBeInTheDocument();
        expect(screen.getByText('dispatched')).toBeInTheDocument();
      });
    });
  });

  describe('Polling Behavior', () => {
    it('should poll execution status every 5 seconds', async () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      // Initial call
      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(1);

      // Advance 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockGetExecutionStatus).toHaveBeenCalledTimes(2);
      });

      // Advance another 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockGetExecutionStatus).toHaveBeenCalledTimes(3);
      });
    });

    it('should stop polling when execution completes', async () => {
      const completedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'completed',
          completed_steps: 3,
          completed_at: 1710864600,
        },
      };

      mockGetExecutionStatus.mockResolvedValue(completedResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();
      });

      // Advance time and verify no more polling
      const callCount = mockGetExecutionStatus.mock.calls.length;
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(callCount);
    });

    it('should stop polling when execution fails', async () => {
      const failedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'failed',
          error_message: 'Transaction reverted',
        },
      };

      mockGetExecutionStatus.mockResolvedValue(failedResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Execution Failed')).toBeInTheDocument();
      });

      // Advance time and verify no more polling
      const callCount = mockGetExecutionStatus.mock.calls.length;
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Completion and Error Callbacks', () => {
    it('should call onComplete callback when execution completes', async () => {
      const completedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'completed',
          completed_steps: 3,
          completed_at: 1710864600,
        },
      };

      mockGetExecutionStatus.mockResolvedValue(completedResponse);

      render(<ExecutionTracker intentId={123} onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onError callback when execution fails', async () => {
      const failedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'failed',
          error_message: 'Transaction reverted',
        },
      };

      mockGetExecutionStatus.mockResolvedValue(failedResponse);

      render(<ExecutionTracker intentId={123} onError={mockOnError} />);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Transaction reverted');
      });
    });

    it('should call onError callback on API error', async () => {
      mockGetExecutionStatus.mockRejectedValue(new Error('Network error'));

      render(<ExecutionTracker intentId={123} onError={mockOnError} />);

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Network error');
      });
    });
  });

  describe('Success and Failure Messages', () => {
    it('should display success message when execution completes', async () => {
      const completedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'completed',
          completed_steps: 3,
          completed_at: 1710864600,
        },
      };

      mockGetExecutionStatus.mockResolvedValue(completedResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Execution Completed Successfully')).toBeInTheDocument();
        expect(
          screen.getByText('All steps have been executed and confirmed on-chain')
        ).toBeInTheDocument();
      });
    });

    it('should display failure message with error details', async () => {
      const failedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'failed',
          error_message: 'Insufficient gas for execution',
        },
      };

      mockGetExecutionStatus.mockResolvedValue(failedResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Execution Failed')).toBeInTheDocument();
        expect(screen.getByText('Insufficient gas for execution')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockGetExecutionStatus.mockRejectedValue(new Error('Network error'));

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Error fetching status')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should continue polling after network error', async () => {
      mockGetExecutionStatus
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Advance time to trigger next poll
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByText('Step 1: Hydration')).toBeInTheDocument();
      });
    });
  });

  describe('Live Indicator', () => {
    it('should display live indicator when polling', async () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument();
      });
    });

    it('should not display live indicator when execution completes', async () => {
      const completedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'completed',
          completed_steps: 3,
          completed_at: 1710864600,
        },
      };

      mockGetExecutionStatus.mockResolvedValue(completedResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.queryByText('Live')).not.toBeInTheDocument();
      });
    });

    it('should not display live indicator when execution fails', async () => {
      const failedResponse: ExecutionStatusResponse = {
        ...mockExecutionResponse,
        execution: {
          ...mockExecutionResponse.execution,
          status: 'failed',
          error_message: 'Transaction reverted',
        },
      };

      mockGetExecutionStatus.mockResolvedValue(failedResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.queryByText('Live')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      render(<ExecutionTracker intentId={123} />);

      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Execution progress tracker' })).toBeInTheDocument();
      });
    });

    it('should have aria-live region for dynamic updates', () => {
      mockGetExecutionStatus.mockResolvedValue(mockExecutionResponse);

      const { container } = render(<ExecutionTracker intentId={123} />);

      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });
  });
});
