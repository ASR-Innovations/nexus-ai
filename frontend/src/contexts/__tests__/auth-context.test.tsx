import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, WalletProvider } from '../auth-context';
import { ReactNode } from 'react';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock window.ethereum
const mockEthereum = {
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn()
};

Object.defineProperty(window, 'ethereum', {
  value: mockEthereum,
  writable: true
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.provider).toBeNull();
  });

  it('should connect wallet successfully', async () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A';
    const mockNonce = 'test-nonce-123';
    const mockSignature = '0xsignature';

    mockEthereum.request
      .mockResolvedValueOnce([mockAddress]) // eth_requestAccounts
      .mockResolvedValueOnce(mockSignature); // personal_sign

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nonce: mockNonce, message: 'Sign this message' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.connect(WalletProvider.METAMASK);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
      expect(result.current.provider).toBe(WalletProvider.METAMASK);
    });

    // Verify localStorage was updated
    expect(localStorageMock.getItem('wallet_address')).toBe(mockAddress);
    expect(localStorageMock.getItem('wallet_signature')).toBe(mockSignature);
    expect(localStorageMock.getItem('wallet_nonce')).toBe(mockNonce);
  });

  it('should disconnect wallet and clear localStorage', async () => {
    // Set up initial connected state
    localStorageMock.setItem('wallet_address', '0x123');
    localStorageMock.setItem('wallet_signature', '0xsig');
    localStorageMock.setItem('wallet_nonce', 'nonce');
    localStorageMock.setItem('wallet_provider', 'metamask');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(localStorageMock.getItem('wallet_address')).toBeNull();
    expect(localStorageMock.getItem('wallet_signature')).toBeNull();
  });

  it('should handle connection errors', async () => {
    mockEthereum.request.mockRejectedValueOnce(new Error('User rejected'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    let caughtError: any = null;
    try {
      await act(async () => {
        await result.current.connect(WalletProvider.METAMASK);
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeTruthy();
    expect(caughtError.message).toBe('User rejected');
    expect(result.current.isConnected).toBe(false);
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
