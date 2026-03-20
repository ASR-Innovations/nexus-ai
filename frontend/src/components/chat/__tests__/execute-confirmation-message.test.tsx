import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExecuteConfirmationMessage } from '../execute-confirmation-message';

describe('ExecuteConfirmationMessage', () => {
  const mockOnExecute = jest.fn();
  const defaultProps = {
    intentId: 123,
    strategyName: 'Hydration Liquidity Pool',
    estimatedGasUsd: 2.5,
    onExecute: mockOnExecute,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should render execute button with strategy name', () => {
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      expect(screen.getByText('Ready to Execute')).toBeInTheDocument();
      expect(screen.getByText(/Hydration Liquidity Pool/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /execute intent/i })).toBeInTheDocument();
    });

    it('should display estimated gas cost', () => {
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      expect(screen.getByText('Estimated Gas Cost')).toBeInTheDocument();
      expect(screen.getByText('$2.50')).toBeInTheDocument();
    });

    it('should display info message about signing', () => {
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      expect(screen.getByText(/Clicking execute will prompt you to sign a transaction/)).toBeInTheDocument();
    });
  });

  describe('Execute Button Interaction', () => {
    it('should call onExecute when button is clicked', async () => {
      mockOnExecute.mockResolvedValue({ txHash: '0x123abc' });
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(mockOnExecute).toHaveBeenCalledWith(123);
      });
    });

    it('should show loading state while executing', async () => {
      mockOnExecute.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ txHash: '0x123abc' }), 100)));
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      expect(screen.getByText('Executing...')).toBeInTheDocument();
      expect(executeButton).toBeDisabled();
    });

    it('should disable button during execution', async () => {
      mockOnExecute.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ txHash: '0x123abc' }), 100)));
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      expect(executeButton).toBeDisabled();
    });
  });

  describe('Success State', () => {
    it('should display transaction confirmation after successful execution', async () => {
      mockOnExecute.mockResolvedValue({ txHash: '0x123abc456def' });
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Intent Execution Started')).toBeInTheDocument();
        expect(screen.getByText('Transaction submitted successfully')).toBeInTheDocument();
      });
    });

    it('should display transaction hash', async () => {
      const txHash = '0x123abc456def789';
      mockOnExecute.mockResolvedValue({ txHash });
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText(txHash)).toBeInTheDocument();
      });
    });

    it('should display block explorer link', async () => {
      mockOnExecute.mockResolvedValue({ txHash: '0x123abc' });
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /view transaction on block explorer/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://polkadot.subscan.io/extrinsic/0x123abc');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should display strategy name in confirmation', async () => {
      mockOnExecute.mockResolvedValue({ txHash: '0x123abc' });
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Strategy')).toBeInTheDocument();
        expect(screen.getByText('Hydration Liquidity Pool')).toBeInTheDocument();
      });
    });

    it('should display tracking info message', async () => {
      mockOnExecute.mockResolvedValue({ txHash: '0x123abc' });
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Your intent is now being executed/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when execution fails', async () => {
      mockOnExecute.mockRejectedValue(new Error('Transaction rejected by user'));
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Transaction rejected by user')).toBeInTheDocument();
      });
    });

    it('should display generic error for non-Error objects', async () => {
      mockOnExecute.mockRejectedValue('Unknown error');
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to execute intent')).toBeInTheDocument();
      });
    });

    it('should re-enable button after error', async () => {
      mockOnExecute.mockRejectedValue(new Error('Network error'));
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
      
      expect(executeButton).not.toBeDisabled();
    });

    it('should allow retry after error', async () => {
      mockOnExecute
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ txHash: '0x123abc' });
      
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      
      // First attempt - fails
      fireEvent.click(executeButton);
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
      
      // Second attempt - succeeds
      fireEvent.click(executeButton);
      await waitFor(() => {
        expect(screen.getByText('Intent Execution Started')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      expect(screen.getByRole('article', { name: /execute intent confirmation/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /execute intent/i })).toBeInTheDocument();
    });

    it('should have proper ARIA labels in success state', async () => {
      mockOnExecute.mockResolvedValue({ txHash: '0x123abc' });
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByRole('article', { name: /execution confirmation/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /view transaction on block explorer/i })).toBeInTheDocument();
      });
    });

    it('should have alert role for error messages', async () => {
      mockOnExecute.mockRejectedValue(new Error('Test error'));
      render(<ExecuteConfirmationMessage {...defaultProps} />);
      
      const executeButton = screen.getByRole('button', { name: /execute intent/i });
      fireEvent.click(executeButton);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Gas Cost Formatting', () => {
    it('should format gas cost with 2 decimal places', () => {
      render(<ExecuteConfirmationMessage {...defaultProps} estimatedGasUsd={1.234} />);
      expect(screen.getByText('$1.23')).toBeInTheDocument();
    });

    it('should handle zero gas cost', () => {
      render(<ExecuteConfirmationMessage {...defaultProps} estimatedGasUsd={0} />);
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle large gas costs', () => {
      render(<ExecuteConfirmationMessage {...defaultProps} estimatedGasUsd={123.456} />);
      expect(screen.getByText('$123.46')).toBeInTheDocument();
    });
  });
});
