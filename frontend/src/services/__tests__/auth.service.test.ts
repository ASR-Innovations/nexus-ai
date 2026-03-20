/**
 * Authentication Service Tests
 * 
 * Tests for nonce-based wallet signature authentication flow.
 */

import {
  AuthServiceImpl,
  createAuthService,
  getAuthService,
  isUserAuthenticated,
  getCurrentWalletAddress,
  getCurrentWalletProvider,
} from '../auth.service';
import { WalletProvider } from '../wallet.service';
import * as apiClientModule from '../api-client.service';
import * as walletServiceModule from '../wallet.service';

// ============================================================================
// Test Setup
// ============================================================================

// Mock API Client
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  cancel: jest.fn(),
  getRateLimitInfo: jest.fn(),
};

// Mock Wallet Service
const mockWalletService = {
  detectWallets: jest.fn(),
  isWalletInstalled: jest.fn(),
  getWalletInfo: jest.fn(),
  getInstalledWallets: jest.fn(),
  getWalletIcon: jest.fn(),
  getWalletDownloadUrl: jest.fn(),
  getProviderObject: jest.fn(),
  waitForProvider: jest.fn(),
  getWalletErrorMessage: jest.fn(),
};

// Mock Wallet Provider
const mockProvider = {
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
};

jest.mock('../api-client.service', () => ({
  getApiClient: () => mockApiClient,
}));

jest.mock('../wallet.service', () => ({
  ...jest.requireActual('../wallet.service'),
  getWalletService: () => mockWalletService,
}));

describe('AuthService', () => {
  let authService: AuthServiceImpl;

  beforeEach(() => {
    authService = new AuthServiceImpl();
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    mockWalletService.getWalletInfo.mockReturnValue({
      id: WalletProvider.METAMASK,
      name: 'MetaMask',
      icon: '/icons/metamask.svg',
      downloadUrl: 'https://metamask.io/download/',
      isInstalled: true,
      provider: mockProvider,
    });
  });

  // ==========================================================================
  // Connect Tests
  // ==========================================================================

  describe('connect', () => {
    it('should successfully authenticate with wallet', async () => {
      // Mock wallet provider responses
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A']) // eth_requestAccounts
        .mockResolvedValueOnce('0xsignature123'); // personal_sign

      // Mock API responses
      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'nonce123',
            message: 'Please sign this message to verify your wallet: nonce123',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        }) // POST /api/auth/nonce
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Signature verified successfully',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        }); // POST /api/auth/verify-signature

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(true);
      expect(result.address).toBe('0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      expect(result.signature).toBe('0xsignature123');
      expect(result.nonce).toBe('nonce123');

      // Verify localStorage
      expect(localStorage.getItem('wallet_address')).toBe('0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      expect(localStorage.getItem('wallet_signature')).toBe('0xsignature123');
      expect(localStorage.getItem('wallet_nonce')).toBe('nonce123');
      expect(localStorage.getItem('wallet_provider')).toBe(WalletProvider.METAMASK);

      // Verify state
      const state = authService.getAuthState();
      expect(state.isConnected).toBe(true);
      expect(state.address).toBe('0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      expect(state.signature).toBe('0xsignature123');
      expect(state.nonce).toBe('nonce123');
      expect(state.provider).toBe(WalletProvider.METAMASK);
    });

    it('should fail when wallet is not installed', async () => {
      mockWalletService.getWalletInfo.mockReturnValue({
        id: WalletProvider.METAMASK,
        name: 'MetaMask',
        icon: '/icons/metamask.svg',
        downloadUrl: 'https://metamask.io/download/',
        isInstalled: false,
        provider: null,
      });

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('MetaMask is not installed');
    });

    it('should fail when provider object is not available', async () => {
      mockWalletService.getWalletInfo.mockReturnValue({
        id: WalletProvider.METAMASK,
        name: 'MetaMask',
        icon: '/icons/metamask.svg',
        downloadUrl: 'https://metamask.io/download/',
        isInstalled: true,
        provider: null,
      });

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get MetaMask provider object');
    });

    it('should handle user rejection of account access', async () => {
      mockProvider.request.mockRejectedValueOnce({ code: 4001 });

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('rejected');
    });

    it('should handle no accounts returned', async () => {
      mockProvider.request.mockResolvedValueOnce([]);

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No accounts found');
    });

    it('should handle nonce request failure', async () => {
      mockProvider.request.mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A']);
      mockApiClient.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to request nonce');
    });

    it('should handle invalid nonce response', async () => {
      mockProvider.request.mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A']);
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: false,
        },
      });

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid nonce response');
    });

    it('should handle user rejection of signature', async () => {
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'])
        .mockRejectedValueOnce({ code: 4001 });

      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          nonce: 'nonce123',
          message: 'Please sign this message to verify your wallet: nonce123',
          address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
          timestamp: Date.now(),
        },
      });

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('rejected');
    });

    it('should handle signature verification failure', async () => {
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'])
        .mockResolvedValueOnce('0xsignature123');

      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'nonce123',
            message: 'Please sign this message to verify your wallet: nonce123',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: false,
          },
        });

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Signature verification failed');
    });

    it('should handle signature verification API error', async () => {
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'])
        .mockResolvedValueOnce('0xsignature123');

      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'nonce123',
            message: 'Please sign this message to verify your wallet: nonce123',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        })
        .mockRejectedValueOnce(new Error('Server error'));

      const result = await authService.connect(WalletProvider.METAMASK);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to verify signature');
    });
  });

  // ==========================================================================
  // Disconnect Tests
  // ==========================================================================

  describe('disconnect', () => {
    it('should clear credentials and reset state', async () => {
      // Set up authenticated state
      localStorage.setItem('wallet_address', '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      localStorage.setItem('wallet_signature', '0xsignature123');
      localStorage.setItem('wallet_nonce', 'nonce123');
      localStorage.setItem('wallet_provider', WalletProvider.METAMASK);

      await authService.disconnect();

      // Verify localStorage is cleared
      expect(localStorage.getItem('wallet_address')).toBeNull();
      expect(localStorage.getItem('wallet_signature')).toBeNull();
      expect(localStorage.getItem('wallet_nonce')).toBeNull();
      expect(localStorage.getItem('wallet_provider')).toBeNull();

      // Verify state is reset
      const state = authService.getAuthState();
      expect(state.isConnected).toBe(false);
      expect(state.address).toBeNull();
      expect(state.signature).toBeNull();
      expect(state.nonce).toBeNull();
      expect(state.provider).toBeNull();
    });
  });

  // ==========================================================================
  // Re-authenticate Tests
  // ==========================================================================

  describe('reAuthenticate', () => {
    it('should successfully re-authenticate with stored credentials', async () => {
      // Set up stored credentials
      localStorage.setItem('wallet_address', '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      localStorage.setItem('wallet_signature', '0xsignature123');
      localStorage.setItem('wallet_nonce', 'nonce123');
      localStorage.setItem('wallet_provider', WalletProvider.METAMASK);

      // Mock API response
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Signature verified successfully',
          address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
          timestamp: Date.now(),
        },
      });

      const result = await authService.reAuthenticate();

      expect(result.success).toBe(true);
      expect(result.address).toBe('0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      expect(result.signature).toBe('0xsignature123');
      expect(result.nonce).toBe('nonce123');

      // Verify state
      const state = authService.getAuthState();
      expect(state.isConnected).toBe(true);
      expect(state.address).toBe('0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
    });

    it('should fail when no stored credentials exist', async () => {
      const result = await authService.reAuthenticate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No stored credentials found');
    });

    it('should clear invalid credentials on verification failure', async () => {
      // Set up stored credentials
      localStorage.setItem('wallet_address', '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      localStorage.setItem('wallet_signature', '0xsignature123');
      localStorage.setItem('wallet_nonce', 'nonce123');
      localStorage.setItem('wallet_provider', WalletProvider.METAMASK);

      // Mock API response - verification fails
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: false,
        },
      });

      const result = await authService.reAuthenticate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stored credentials are invalid');

      // Verify credentials are cleared
      expect(localStorage.getItem('wallet_address')).toBeNull();
      expect(localStorage.getItem('wallet_signature')).toBeNull();
      expect(localStorage.getItem('wallet_nonce')).toBeNull();
      expect(localStorage.getItem('wallet_provider')).toBeNull();
    });

    it('should clear invalid credentials on API error', async () => {
      // Set up stored credentials
      localStorage.setItem('wallet_address', '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      localStorage.setItem('wallet_signature', '0xsignature123');
      localStorage.setItem('wallet_nonce', 'nonce123');
      localStorage.setItem('wallet_provider', WalletProvider.METAMASK);

      // Mock API error
      mockApiClient.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.reAuthenticate();

      expect(result.success).toBe(false);

      // Verify credentials are cleared
      expect(localStorage.getItem('wallet_address')).toBeNull();
    });
  });

  // ==========================================================================
  // State Management Tests
  // ==========================================================================

  describe('getAuthState', () => {
    it('should return current authentication state', () => {
      const state = authService.getAuthState();

      expect(state).toHaveProperty('isConnected');
      expect(state).toHaveProperty('isAuthenticating');
      expect(state).toHaveProperty('address');
      expect(state).toHaveProperty('signature');
      expect(state).toHaveProperty('nonce');
      expect(state).toHaveProperty('provider');
      expect(state).toHaveProperty('error');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when authenticated', async () => {
      // Mock successful authentication
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'])
        .mockResolvedValueOnce('0xsignature123');

      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'nonce123',
            message: 'Please sign this message to verify your wallet: nonce123',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Signature verified successfully',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        });

      await authService.connect(WalletProvider.METAMASK);

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  // ==========================================================================
  // Initialize Auth Tests
  // ==========================================================================

  describe('initializeAuth', () => {
    it('should successfully restore session from localStorage', async () => {
      // Set up stored credentials
      localStorage.setItem('wallet_address', '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      localStorage.setItem('wallet_signature', '0xsignature123');
      localStorage.setItem('wallet_nonce', 'nonce123');
      localStorage.setItem('wallet_provider', WalletProvider.METAMASK);

      // Mock API response
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Signature verified successfully',
          address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
          timestamp: Date.now(),
        },
      });

      await authService.initializeAuth();

      // Verify state is restored
      const state = authService.getAuthState();
      expect(state.isConnected).toBe(true);
      expect(state.address).toBe('0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should handle no stored credentials gracefully', async () => {
      await authService.initializeAuth();

      // Should not throw and state should remain disconnected
      const state = authService.getAuthState();
      expect(state.isConnected).toBe(false);
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle invalid stored credentials gracefully', async () => {
      // Set up stored credentials
      localStorage.setItem('wallet_address', '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A');
      localStorage.setItem('wallet_signature', '0xsignature123');
      localStorage.setItem('wallet_nonce', 'nonce123');
      localStorage.setItem('wallet_provider', WalletProvider.METAMASK);

      // Mock API response - verification fails
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: false,
        },
      });

      await authService.initializeAuth();

      // Should not throw and credentials should be cleared
      expect(localStorage.getItem('wallet_address')).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  // ==========================================================================
  // Account Change Detection Tests
  // ==========================================================================

  describe('Account Change Detection', () => {
    it('should set up account change listener after successful connection', async () => {
      // Mock successful authentication
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'])
        .mockResolvedValueOnce('0xsignature123');

      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'nonce123',
            message: 'Please sign this message to verify your wallet: nonce123',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Signature verified successfully',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        });

      mockProvider.on = jest.fn();

      await authService.connect(WalletProvider.METAMASK);

      // Verify listener was registered
      expect(mockProvider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    });

    it('should disconnect when wallet is locked (no accounts)', async () => {
      // First, authenticate
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'])
        .mockResolvedValueOnce('0xsignature123');

      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'nonce123',
            message: 'Please sign this message to verify your wallet: nonce123',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Signature verified successfully',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        });

      let accountChangeHandler: any;
      mockProvider.on = jest.fn((event, handler) => {
        if (event === 'accountsChanged') {
          accountChangeHandler = handler;
        }
      });

      await authService.connect(WalletProvider.METAMASK);

      // Simulate wallet lock (empty accounts array)
      await accountChangeHandler([]);

      // Verify disconnection
      const state = authService.getAuthState();
      expect(state.isConnected).toBe(false);
      expect(localStorage.getItem('wallet_address')).toBeNull();
    });

    it('should re-authenticate when account changes', async () => {
      // First, authenticate with account 1
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'])
        .mockResolvedValueOnce('0xsignature123');

      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'nonce123',
            message: 'Please sign this message to verify your wallet: nonce123',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Signature verified successfully',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        });

      let accountChangeHandler: any;
      mockProvider.on = jest.fn((event, handler) => {
        if (event === 'accountsChanged') {
          accountChangeHandler = handler;
        }
      });

      await authService.connect(WalletProvider.METAMASK);

      // Mock re-authentication with new account
      mockProvider.request
        .mockResolvedValueOnce(['0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'])
        .mockResolvedValueOnce('0xnewsignature456');

      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'newnonce456',
            message: 'Please sign this message to verify your wallet: newnonce456',
            address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
            timestamp: Date.now(),
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Signature verified successfully',
            address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
            timestamp: Date.now(),
          },
        });

      // Simulate account change
      await accountChangeHandler(['0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199']);

      // Verify re-authentication with new account
      const state = authService.getAuthState();
      expect(state.address).toBe('0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199');
      expect(localStorage.getItem('wallet_address')).toBe('0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199');
    });

    it('should clean up listener on disconnect', async () => {
      // First, authenticate
      mockProvider.request
        .mockResolvedValueOnce(['0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A'])
        .mockResolvedValueOnce('0xsignature123');

      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: true,
            nonce: 'nonce123',
            message: 'Please sign this message to verify your wallet: nonce123',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Signature verified successfully',
            address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A',
            timestamp: Date.now(),
          },
        });

      mockProvider.on = jest.fn();
      mockProvider.removeListener = jest.fn();

      await authService.connect(WalletProvider.METAMASK);

      // Disconnect
      await authService.disconnect();

      // Verify listener was removed
      expect(mockProvider.removeListener).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    });
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe('Singleton Functions', () => {
    it('should create auth service instance', () => {
      const service = createAuthService();
      expect(service).toBeDefined();
    });

    it('should return same instance from getAuthService', () => {
      const service1 = getAuthService();
      const service2 = getAuthService();
      expect(service1).toBe(service2);
    });
  });

  // ==========================================================================
  // Convenience Function Tests
  // ==========================================================================

  describe('Convenience Functions', () => {
    it('isUserAuthenticated should return authentication status', () => {
      expect(isUserAuthenticated()).toBe(false);
    });

    it('getCurrentWalletAddress should return current address', () => {
      expect(getCurrentWalletAddress()).toBeNull();
    });

    it('getCurrentWalletProvider should return current provider', () => {
      expect(getCurrentWalletProvider()).toBeNull();
    });
  });
});
