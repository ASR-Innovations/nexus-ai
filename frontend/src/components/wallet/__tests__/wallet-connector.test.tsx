import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletConnector } from '../wallet-connector';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/components/Toast';
import { getWalletService } from '@/services/wallet.service';

// Mock dependencies
jest.mock('@/contexts/auth-context');
jest.mock('@/components/Toast');
jest.mock('@/services/wallet.service');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockGetWalletService = getWalletService as jest.MockedFunction<typeof getWalletService>;

describe('WalletConnector', () => {
  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();
  const mockShowError = jest.fn();
  const mockShowSuccess = jest.fn();
  const mockDetectWallets = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseToast.mockReturnValue({
      error: mockShowError,
      success: mockShowSuccess,
      warning: jest.fn(),
      info: jest.fn(),
      toasts: [],
      addToast: jest.fn(),
      removeToast: jest.fn(),
      transactionRejected: jest.fn(),
    });

    mockGetWalletService.mockReturnValue({
      detectWallets: mockDetectWallets,
      getWalletInfo: jest.fn(),
      isWalletInstalled: jest.fn(),
      getInstalledWallets: jest.fn(),
      getWalletIcon: jest.fn(),
      getWalletDownloadUrl: jest.fn(),
      getProviderObject: jest.fn(),
      waitForProvider: jest.fn(),
      getWalletErrorMessage: jest.fn(),
    } as any);

    mockDetectWallets.mockReturnValue({
      availableWallets: [
        {
          id: 'metamask',
          name: 'MetaMask',
          icon: '/icons/metamask.svg',
          downloadUrl: 'https://metamask.io/download/',
          isInstalled: true,
          provider: {},
        },
        {
          id: 'subwallet',
          name: 'SubWallet',
          icon: '/icons/subwallet.svg',
          downloadUrl: 'https://www.subwallet.app/download.html',
          isInstalled: false,
        },
        {
          id: 'talisman',
          name: 'Talisman',
          icon: '/icons/talisman.svg',
          downloadUrl: 'https://www.talisman.xyz/download',
          isInstalled: false,
        },
      ],
      installedWallets: [],
      hasMultipleWallets: false,
    });
  });

  describe('Disconnected State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isConnected: false,
        isAuthenticating: false,
        address: null,
        signature: null,
        nonce: null,
        provider: null,
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        reAuthenticate: jest.fn(),
        clearError: jest.fn(),
      });
    });

    it('renders Connect Wallet button when disconnected', () => {
      render(<WalletConnector />);
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('shows loading state when authenticating', () => {
      mockUseAuth.mockReturnValue({
        isConnected: false,
        isAuthenticating: true,
        address: null,
        signature: null,
        nonce: null,
        provider: null,
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        reAuthenticate: jest.fn(),
        clearError: jest.fn(),
      });

      render(<WalletConnector />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('opens wallet selection dialog when Connect Wallet is clicked', () => {
      render(<WalletConnector />);
      
      const connectButton = screen.getByText('Connect Wallet');
      fireEvent.click(connectButton);

      expect(screen.getByText('Choose a wallet to connect to the application')).toBeInTheDocument();
    });

    it('displays all available wallets in dialog', () => {
      render(<WalletConnector />);
      
      const connectButton = screen.getByText('Connect Wallet');
      fireEvent.click(connectButton);

      expect(screen.getByText('MetaMask')).toBeInTheDocument();
      expect(screen.getByText('SubWallet')).toBeInTheDocument();
      expect(screen.getByText('Talisman')).toBeInTheDocument();
    });

    it('shows "Not installed" for wallets that are not installed', () => {
      render(<WalletConnector />);
      
      const connectButton = screen.getByText('Connect Wallet');
      fireEvent.click(connectButton);

      const notInstalledElements = screen.getAllByText('Not installed');
      expect(notInstalledElements).toHaveLength(2); // SubWallet and Talisman
    });
  });

  describe('Connected State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isConnected: true,
        isAuthenticating: false,
        address: '0x1234567890abcdef1234567890abcdef12345678',
        signature: 'mock-signature',
        nonce: 'mock-nonce',
        provider: 'metamask' as any,
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        reAuthenticate: jest.fn(),
        clearError: jest.fn(),
      });

      mockGetWalletService.mockReturnValue({
        detectWallets: mockDetectWallets,
        getWalletInfo: jest.fn().mockReturnValue({
          id: 'metamask',
          name: 'MetaMask',
          icon: '/icons/metamask.svg',
          downloadUrl: 'https://metamask.io/download/',
          isInstalled: true,
          provider: {},
        }),
        isWalletInstalled: jest.fn(),
        getInstalledWallets: jest.fn(),
        getWalletIcon: jest.fn(),
        getWalletDownloadUrl: jest.fn(),
        getProviderObject: jest.fn(),
        waitForProvider: jest.fn(),
        getWalletErrorMessage: jest.fn(),
      } as any);
    });

    it('displays truncated address when connected', () => {
      render(<WalletConnector />);
      expect(screen.getByText('0x1234...5678')).toBeInTheDocument();
    });

    it('displays Disconnect button when connected', () => {
      render(<WalletConnector />);
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('shows green indicator when connected', () => {
      const { container } = render(<WalletConnector />);
      const indicator = container.querySelector('.bg-green-500');
      expect(indicator).toBeInTheDocument();
    });

    it('calls disconnect when Disconnect button is clicked', async () => {
      render(<WalletConnector />);
      
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
      });
    });
  });

  describe('Wallet Connection Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isConnected: false,
        isAuthenticating: false,
        address: null,
        signature: null,
        nonce: null,
        provider: null,
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        reAuthenticate: jest.fn(),
        clearError: jest.fn(),
      });
    });

    it('calls connect with correct provider when wallet is clicked', async () => {
      mockConnect.mockResolvedValue(undefined);

      render(<WalletConnector />);
      
      const connectButton = screen.getByText('Connect Wallet');
      fireEvent.click(connectButton);

      const metamaskOption = screen.getByText('MetaMask');
      fireEvent.click(metamaskOption);

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith('metamask');
      });
    });

    it('shows success toast on successful connection', async () => {
      mockConnect.mockResolvedValue(undefined);

      render(<WalletConnector />);
      
      const connectButton = screen.getByText('Connect Wallet');
      fireEvent.click(connectButton);

      const metamaskOption = screen.getByText('MetaMask');
      fireEvent.click(metamaskOption);

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalled();
      });
    });

    it('shows error toast on connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      render(<WalletConnector />);
      
      const connectButton = screen.getByText('Connect Wallet');
      fireEvent.click(connectButton);

      const metamaskOption = screen.getByText('MetaMask');
      fireEvent.click(metamaskOption);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Connection Failed', 'Connection failed');
      });
    });
  });

  describe('Installation Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isConnected: false,
        isAuthenticating: false,
        address: null,
        signature: null,
        nonce: null,
        provider: null,
        error: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        reAuthenticate: jest.fn(),
        clearError: jest.fn(),
      });
    });

    it('opens download URL when clicking on non-installed wallet', () => {
      const mockOpen = jest.fn();
      window.open = mockOpen;

      render(<WalletConnector />);
      
      const connectButton = screen.getByText('Connect Wallet');
      fireEvent.click(connectButton);

      const subwalletOption = screen.getByText('SubWallet');
      fireEvent.click(subwalletOption);

      expect(mockOpen).toHaveBeenCalledWith(
        'https://www.subwallet.app/download.html',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });
});
