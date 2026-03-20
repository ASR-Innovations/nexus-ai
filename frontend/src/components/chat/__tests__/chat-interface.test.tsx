import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../chat-interface';
import { useWallet } from '@/hooks/use-wallet';
import { getChatService } from '@/services/chat.service';

// Mock dependencies
jest.mock('@/hooks/use-wallet');
jest.mock('@/services/chat.service');

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockGetChatService = getChatService as jest.MockedFunction<typeof getChatService>;

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe('ChatInterface', () => {
  const mockChatService = {
    sendMessage: jest.fn(),
    createIntent: jest.fn(),
    approvePlan: jest.fn(),
    executeIntent: jest.fn(),
    getExecutionStatus: jest.fn(),
    getConversationHistory: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetChatService.mockReturnValue(mockChatService as any);
  });

  describe('Wallet Connection', () => {
    it('should show wallet connection prompt when not connected', () => {
      mockUseWallet.mockReturnValue({
        address: null,
        isConnected: false,
        isConnecting: false,
        provider: null,
        signer: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        switchNetwork: jest.fn(),
      });

      render(<ChatInterface />);

      expect(screen.getByText(/Welcome to NexusAI Protocol/i)).toBeInTheDocument();
      expect(screen.getByText(/Connect your wallet/i)).toBeInTheDocument();
    });

    it('should show chat interface when wallet is connected', () => {
      mockUseWallet.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        isConnecting: false,
        provider: {} as any,
        signer: {} as any,
        connect: jest.fn(),
        disconnect: jest.fn(),
        switchNetwork: jest.fn(),
      });

      render(<ChatInterface />);

      // Should show chat input
      expect(screen.getByPlaceholderText(/Describe your DeFi goals/i)).toBeInTheDocument();
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        isConnecting: false,
        provider: {} as any,
        signer: {} as any,
        connect: jest.fn(),
        disconnect: jest.fn(),
        switchNetwork: jest.fn(),
      });
    });

    it('should send message when user submits', async () => {
      const user = userEvent.setup();
      
      mockChatService.sendMessage.mockResolvedValue({
        success: true,
        message: 'Here are some strategies for you',
        strategies: [],
        confidence: 80,
        conversationId: 'conv-123',
        isHighConfidence: true,
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/Describe your DeFi goals/i);
      await user.type(input, 'Find me yield opportunities');
      
      const sendButton = screen.getByLabelText(/Send message/i);
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockChatService.sendMessage).toHaveBeenCalledWith({
          message: 'Find me yield opportunities',
          userId: '0x1234567890123456789012345678901234567890',
          conversationId: undefined,
        });
      });
    });

    it('should display assistant response after sending message', async () => {
      const user = userEvent.setup();
      
      mockChatService.sendMessage.mockResolvedValue({
        success: true,
        message: 'Here are some strategies for you',
        strategies: [],
        confidence: 80,
        conversationId: 'conv-123',
        isHighConfidence: true,
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/Describe your DeFi goals/i);
      await user.type(input, 'Find me yield opportunities');
      
      const sendButton = screen.getByLabelText(/Send message/i);
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Here are some strategies for you')).toBeInTheDocument();
      });
    });

    it('should show error message when send fails', async () => {
      const user = userEvent.setup();
      
      mockChatService.sendMessage.mockRejectedValue(new Error('Network error'));

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/Describe your DeFi goals/i);
      await user.type(input, 'Find me yield opportunities');
      
      const sendButton = screen.getByLabelText(/Send message/i);
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Strategy Approval', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        isConnecting: false,
        provider: {} as any,
        signer: {} as any,
        connect: jest.fn(),
        disconnect: jest.fn(),
        switchNetwork: jest.fn(),
      });
    });

    it('should open approval dialog when strategy is approved', async () => {
      const user = userEvent.setup();
      
      const mockStrategy = {
        name: 'Hydration Liquidity Pool',
        protocol: 'Hydration',
        chain: 'Hydration',
        apy: 15.5,
        risk: 'medium' as const,
        lockPeriod: 0,
        estimatedGasUsd: 2.5,
        pros: ['High APY', 'No lock period'],
        cons: ['Impermanent loss risk'],
        explanation: 'Provide liquidity to earn fees',
      };

      mockChatService.sendMessage.mockResolvedValue({
        success: true,
        message: 'Here are some strategies',
        strategies: [mockStrategy],
        confidence: 80,
        conversationId: 'conv-123',
        isHighConfidence: true,
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText(/Describe your DeFi goals/i);
      await user.type(input, 'Find me yield opportunities');
      
      const sendButton = screen.getByLabelText(/Send message/i);
      await user.click(sendButton);

      // Wait for strategy card to appear
      await waitFor(() => {
        expect(screen.getByText('Hydration Liquidity Pool')).toBeInTheDocument();
      });

      // Click approve button
      const approveButton = screen.getByLabelText(/Approve strategy/i);
      await user.click(approveButton);

      // Dialog should open
      await waitFor(() => {
        expect(screen.getByText(/Confirm Strategy Approval/i)).toBeInTheDocument();
      });
    });
  });
});
