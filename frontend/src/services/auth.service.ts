/**
 * Authentication Service
 * 
 * Handles nonce-based wallet signature authentication flow:
 * 1. Request nonce from backend
 * 2. Request wallet signature for nonce message
 * 3. Verify signature with backend
 * 4. Store credentials in localStorage
 */

import { getApiClient } from './api-client.service';
import { getWalletService, WalletProvider } from './wallet.service';
import { API_ENDPOINTS } from '@/lib/api-endpoints';

// Re-export WalletProvider for convenience
export { WalletProvider } from './wallet.service';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AuthService {
  connect(provider: WalletProvider): Promise<AuthResult>;
  disconnect(): Promise<void>;
  reAuthenticate(): Promise<AuthResult>;
  getAuthState(): AuthState;
  isAuthenticated(): boolean;
  initializeAuth(): Promise<void>;
}

export interface AuthResult {
  success: boolean;
  address?: string;
  signature?: string;
  nonce?: string;
  error?: string;
}

export interface AuthState {
  isConnected: boolean;
  isAuthenticating: boolean;
  address: string | null;
  signature: string | null;
  nonce: string | null;
  provider: WalletProvider | null;
  error: string | null;
}

interface NonceResponse {
  success: boolean;
  nonce: string;
  address: string;
  timestamp: number;
  message: string;
}

interface VerifySignatureResponse {
  success: boolean;
  message: string;
  address: string;
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  ADDRESS: 'wallet_address',
  SIGNATURE: 'wallet_signature',
  NONCE: 'wallet_nonce',
  TIMESTAMP: 'wallet_timestamp',
  PROVIDER: 'wallet_provider',
} as const;

// ============================================================================
// Authentication Service Class
// ============================================================================

export class AuthServiceImpl implements AuthService {
  private state: AuthState = {
    isConnected: false,
    isAuthenticating: false,
    address: null,
    signature: null,
    nonce: null,
    provider: null,
    error: null,
  };

  private accountChangeListener: ((accounts: string[]) => void) | null = null;

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Connect to a wallet provider and authenticate
   */
  async connect(provider: WalletProvider): Promise<AuthResult> {
    try {
      this.setState({ isAuthenticating: true, error: null });

      // Step 1: Get wallet service and check if provider is installed
      const walletService = getWalletService();
      const walletInfo = walletService.getWalletInfo(provider);

      if (!walletInfo.isInstalled) {
        const error = `${walletInfo.name} is not installed. Please install it to continue.`;
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      // Step 2: Request account access from wallet
      const providerObject = walletInfo.provider;
      if (!providerObject) {
        const error = `Failed to get ${walletInfo.name} provider object.`;
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      let accounts: string[];
      try {
        accounts = await providerObject.request({
          method: 'eth_requestAccounts',
        });
      } catch (err: any) {
        const error = this.getWalletErrorMessage(err);
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      if (!accounts || accounts.length === 0) {
        const error = 'No accounts found. Please unlock your wallet.';
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      const address = accounts[0];

      // Step 2.5: Switch to Paseo testnet
      await this.switchToPaseoNetwork(providerObject);

      // Step 3: Request nonce from backend
      const apiClient = getApiClient();
      let nonceResponse: NonceResponse;

      try {
        const response = await apiClient.post<NonceResponse>(
          API_ENDPOINTS.AUTH_NONCE,
          { address },
          { requiresAuth: false }
        );
        nonceResponse = response.data;
      } catch (err: any) {
        const error = `Failed to request nonce: ${err.message || 'Unknown error'}`;
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      if (!nonceResponse.success || !nonceResponse.nonce || !nonceResponse.message) {
        const error = 'Invalid nonce response from server.';
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      const { nonce, message } = nonceResponse;

      // Step 4: Request wallet signature for nonce message
      let signature: string;
      try {
        signature = await providerObject.request({
          method: 'personal_sign',
          params: [message, address],
        });
      } catch (err: any) {
        const error = this.getWalletErrorMessage(err);
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      if (!signature) {
        const error = 'Failed to obtain signature from wallet.';
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      // Step 5: Verify signature with backend
      let verifyResponse: VerifySignatureResponse;

      try {
        const response = await apiClient.post<VerifySignatureResponse>(
          API_ENDPOINTS.AUTH_VERIFY,
          {
            address,
            signature,
            message, // Use the full formatted message, not the nonce
          },
          { requiresAuth: false }
        );
        verifyResponse = response.data;
      } catch (err: any) {
        const error = `Failed to verify signature: ${err.message || 'Unknown error'}`;
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      if (!verifyResponse.success) {
        const error = 'Signature verification failed. Please try again.';
        this.setState({ isAuthenticating: false, error });
        return { success: false, error };
      }

      // Step 6: Store credentials in localStorage
      this.storeCredentials(address, signature, message, nonceResponse.timestamp, provider);

      // Step 7: Update state
      this.setState({
        isConnected: true,
        isAuthenticating: false,
        address,
        signature,
        nonce: message, // Store the full message, not just the nonce
        provider,
        error: null,
      });

      // Step 8: Set up account change listener
      this.setupAccountChangeListener(provider);

      console.log('[Auth Service] Successfully authenticated:', address);

      return {
        success: true,
        address,
        signature,
        nonce: message, // Return the full message
      };
    } catch (err: any) {
      const error = `Authentication failed: ${err.message || 'Unknown error'}`;
      this.setState({ isAuthenticating: false, error });
      console.error('[Auth Service] Authentication error:', err);
      return { success: false, error };
    }
  }

  /**
   * Disconnect and clear session
   */
  async disconnect(): Promise<void> {
    try {
      // Clean up account change listener
      this.cleanupAccountChangeListener();

      // Clear localStorage
      this.clearCredentials();

      // Reset state
      this.setState({
        isConnected: false,
        isAuthenticating: false,
        address: null,
        signature: null,
        nonce: null,
        provider: null,
        error: null,
      });

      console.log('[Auth Service] Disconnected successfully');
    } catch (err: any) {
      console.error('[Auth Service] Disconnect error:', err);
      throw err;
    }
  }

  /**
   * Re-authenticate using stored credentials
   */
  async reAuthenticate(): Promise<AuthResult> {
    try {
      this.setState({ isAuthenticating: true, error: null });

      // Check if credentials exist in localStorage
      const storedAddress = this.getStoredValue(STORAGE_KEYS.ADDRESS);
      const storedSignature = this.getStoredValue(STORAGE_KEYS.SIGNATURE);
      const storedNonce = this.getStoredValue(STORAGE_KEYS.NONCE);
      const storedProvider = this.getStoredValue(STORAGE_KEYS.PROVIDER) as WalletProvider | null;

      if (!storedAddress || !storedSignature || !storedNonce || !storedProvider) {
        this.setState({ isAuthenticating: false });
        return { success: false, error: 'No stored credentials found.' };
      }

      // Verify stored credentials with backend
      const apiClient = getApiClient();
      let verifyResponse: VerifySignatureResponse;

      try {
        const response = await apiClient.post<VerifySignatureResponse>(
          API_ENDPOINTS.AUTH_VERIFY,
          {
            address: storedAddress,
            signature: storedSignature,
            message: storedNonce, // This is actually the full message, not just nonce
          },
          { requiresAuth: false }
        );
        verifyResponse = response.data;
      } catch (err: any) {
        // Credentials are invalid, clear them
        this.clearCredentials();
        this.setState({ isAuthenticating: false });
        return { success: false, error: 'Stored credentials are invalid.' };
      }

      if (!verifyResponse.success) {
        // Credentials are invalid, clear them
        this.clearCredentials();
        this.setState({ isAuthenticating: false });
        return { success: false, error: 'Stored credentials are invalid.' };
      }

      // Update state with stored credentials
      this.setState({
        isConnected: true,
        isAuthenticating: false,
        address: storedAddress,
        signature: storedSignature,
        nonce: storedNonce,
        provider: storedProvider,
        error: null,
      });

      console.log('[Auth Service] Re-authenticated successfully:', storedAddress);

      return {
        success: true,
        address: storedAddress,
        signature: storedSignature,
        nonce: storedNonce,
      };
    } catch (err: any) {
      const error = `Re-authentication failed: ${err.message || 'Unknown error'}`;
      this.setState({ isAuthenticating: false, error });
      console.error('[Auth Service] Re-authentication error:', err);
      return { success: false, error };
    }
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.state };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isConnected && !!this.state.address && !!this.state.signature;
  }

  /**
   * Initialize authentication on page load
   * Attempts to restore session from localStorage
   */
  async initializeAuth(): Promise<void> {
    try {
      console.log('[Auth Service] Initializing authentication...');

      // Attempt to re-authenticate using stored credentials
      const result = await this.reAuthenticate();

      if (result.success && this.state.provider) {
        // Set up account change listener if re-authentication succeeded
        this.setupAccountChangeListener(this.state.provider);
        console.log('[Auth Service] Auto-reconnection successful');
      } else {
        console.log('[Auth Service] No valid stored credentials found');
      }
    } catch (err: any) {
      console.error('[Auth Service] Initialization error:', err);
      // Don't throw - initialization failure is not critical
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Update internal state
   */
  private setState(updates: Partial<AuthState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Store credentials in localStorage
   */
  private storeCredentials(
    address: string,
    signature: string,
    message: string, // Full formatted message that was signed
    timestamp: number,
    provider: WalletProvider
  ): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEYS.ADDRESS, address);
      localStorage.setItem(STORAGE_KEYS.SIGNATURE, signature);
      localStorage.setItem(STORAGE_KEYS.NONCE, message); // Store full message
      localStorage.setItem(STORAGE_KEYS.TIMESTAMP, timestamp.toString());
      localStorage.setItem(STORAGE_KEYS.PROVIDER, provider);
    } catch (err) {
      console.error('[Auth Service] Failed to store credentials:', err);
    }
  }

  /**
   * Clear credentials from localStorage
   */
  private clearCredentials(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(STORAGE_KEYS.ADDRESS);
      localStorage.removeItem(STORAGE_KEYS.SIGNATURE);
      localStorage.removeItem(STORAGE_KEYS.NONCE);
      localStorage.removeItem(STORAGE_KEYS.TIMESTAMP);
      localStorage.removeItem(STORAGE_KEYS.PROVIDER);
    } catch (err) {
      console.error('[Auth Service] Failed to clear credentials:', err);
    }
  }

  /**
   * Get stored value from localStorage
   */
  private getStoredValue(key: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.error('[Auth Service] Failed to get stored value:', err);
      return null;
    }
  }

  /**
   * Switch MetaMask to Paseo testnet (Polkadot Hub Testnet)
   */
  private async switchToPaseoNetwork(provider: any): Promise<void> {
    const chainIdHex = '0x190F1B41'; // 420420417 decimal
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      // 4902 = chain not added yet
      if (switchError.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: 'Polkadot Hub Testnet (Paseo)',
              nativeCurrency: { name: 'PAS', symbol: 'PAS', decimals: 18 },
              rpcUrls: ['https://eth-rpc-testnet.polkadot.io/'],
              blockExplorerUrls: ['https://assethub-paseo.subscan.io'],
            }],
          });
        } catch (addError: any) {
          console.warn('[Auth Service] Failed to add Paseo network:', addError);
        }
      } else {
        console.warn('[Auth Service] Failed to switch to Paseo network:', switchError);
      }
      // Non-fatal: continue auth flow even if network switch fails
    }
  }

  /**
   * Get user-friendly error message from wallet error
   */
  private getWalletErrorMessage(error: any): string {
    // User rejected the request
    if (error.code === 4001) {
      return 'Connection request was rejected. Please try again.';
    }

    // Request already pending
    if (error.code === -32002) {
      return 'Connection request is already pending. Please check your wallet.';
    }

    // User rejected signature
    if (error.code === 4001 || error.message?.includes('User denied')) {
      return 'Signature request was rejected. Please try again.';
    }

    // Generic error
    if (error.message) {
      return error.message;
    }

    return 'Failed to connect to wallet. Please try again.';
  }

  /**
   * Set up account change listener for wallet provider
   */
  private setupAccountChangeListener(provider: WalletProvider): void {
    // Clean up existing listener first
    this.cleanupAccountChangeListener();

    const walletService = getWalletService();
    const walletInfo = walletService.getWalletInfo(provider);
    const providerObject = walletInfo.provider;

    if (!providerObject) {
      console.warn('[Auth Service] Cannot set up account change listener: provider not found');
      return;
    }

    // Create account change handler
    this.accountChangeListener = async (accounts: string[]) => {
      console.log('[Auth Service] Account changed detected:', accounts);

      // Handle wallet disconnection (no accounts)
      if (!accounts || accounts.length === 0) {
        console.log('[Auth Service] Wallet disconnected or locked');
        await this.disconnect();
        return;
      }

      const newAddress = accounts[0];
      const currentAddress = this.state.address;

      // Check if account actually changed
      if (newAddress && newAddress.toLowerCase() !== currentAddress?.toLowerCase()) {
        console.log('[Auth Service] Account switched from', currentAddress, 'to', newAddress);

        // Clear old session
        this.clearCredentials();

        // Trigger re-authentication with new account
        try {
          await this.connect(provider);
        } catch (err: any) {
          console.error('[Auth Service] Failed to re-authenticate after account change:', err);
          this.setState({ error: 'Failed to authenticate with new account. Please try again.' });
        }
      }
    };

    // Register the listener
    try {
      providerObject.on('accountsChanged', this.accountChangeListener);
      console.log('[Auth Service] Account change listener registered for', provider);
    } catch (err: any) {
      console.error('[Auth Service] Failed to register account change listener:', err);
    }
  }

  /**
   * Clean up account change listener
   */
  private cleanupAccountChangeListener(): void {
    if (!this.accountChangeListener || !this.state.provider) {
      return;
    }

    const walletService = getWalletService();
    const walletInfo = walletService.getWalletInfo(this.state.provider);
    const providerObject = walletInfo.provider;

    if (providerObject) {
      try {
        providerObject.removeListener('accountsChanged', this.accountChangeListener);
        console.log('[Auth Service] Account change listener removed');
      } catch (err: any) {
        console.error('[Auth Service] Failed to remove account change listener:', err);
      }
    }

    this.accountChangeListener = null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let authServiceInstance: AuthServiceImpl | null = null;

export function createAuthService(): AuthService {
  authServiceInstance = new AuthServiceImpl();
  return authServiceInstance;
}

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthServiceImpl();
  }
  return authServiceInstance;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick check if user is authenticated
 */
export function isUserAuthenticated(): boolean {
  const service = getAuthService();
  return service.isAuthenticated();
}

/**
 * Get current wallet address
 */
export function getCurrentWalletAddress(): string | null {
  const service = getAuthService();
  return service.getAuthState().address;
}

/**
 * Get current wallet provider
 */
export function getCurrentWalletProvider(): WalletProvider | null {
  const service = getAuthService();
  return service.getAuthState().provider;
}
