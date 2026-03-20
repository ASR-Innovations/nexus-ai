/**
 * Authentication Service Integration Example
 * 
 * This file demonstrates how to use the AuthService in a real application.
 * This is NOT a test file - it's documentation code.
 */

import { getAuthService, WalletProvider } from '../auth.service';

// ============================================================================
// Example 1: Basic Wallet Connection
// ============================================================================

async function connectWallet() {
  const authService = getAuthService();
  
  // Connect to MetaMask
  const result = await authService.connect(WalletProvider.METAMASK);
  
  if (result.success) {
    console.log('✅ Connected successfully!');
    console.log('Address:', result.address);
    console.log('Signature:', result.signature);
    console.log('Nonce:', result.nonce);
    
    // Credentials are automatically stored in localStorage
    // and will be used by API Client for authenticated requests
  } else {
    console.error('❌ Connection failed:', result.error);
    
    // Show error to user (e.g., via toast notification)
    // toast.error(result.error);
  }
}

// ============================================================================
// Example 2: Auto-Reconnection on Page Load
// ============================================================================

async function initializeAuth() {
  const authService = getAuthService();
  
  // Try to re-authenticate using stored credentials
  const result = await authService.reAuthenticate();
  
  if (result.success) {
    console.log('✅ Auto-reconnected:', result.address);
    return true;
  } else {
    console.log('ℹ️ No stored credentials or invalid session');
    return false;
  }
}

// ============================================================================
// Example 3: Disconnect Wallet
// ============================================================================

async function disconnectWallet() {
  const authService = getAuthService();
  
  await authService.disconnect();
  
  console.log('✅ Disconnected successfully');
  
  // All credentials are cleared from localStorage
  // User will need to reconnect to make authenticated requests
}

// ============================================================================
// Example 4: Check Authentication Status
// ============================================================================

function checkAuthStatus() {
  const authService = getAuthService();
  
  if (authService.isAuthenticated()) {
    const state = authService.getAuthState();
    console.log('✅ User is authenticated');
    console.log('Address:', state.address);
    console.log('Provider:', state.provider);
  } else {
    console.log('❌ User is not authenticated');
  }
}

// ============================================================================
// Example 5: React Component Integration
// ============================================================================

/*
import { useState, useEffect } from 'react';
import { getAuthService, WalletProvider } from '@/services/auth.service';

function WalletButton() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-reconnect on mount
  useEffect(() => {
    const authService = getAuthService();
    
    authService.reAuthenticate().then((result) => {
      if (result.success) {
        setAddress(result.address || null);
      }
    });
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    const authService = getAuthService();
    const result = await authService.connect(WalletProvider.METAMASK);

    if (result.success) {
      setAddress(result.address || null);
    } else {
      setError(result.error || 'Connection failed');
    }

    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
    const authService = getAuthService();
    await authService.disconnect();
    setAddress(null);
  };

  if (address) {
    return (
      <button onClick={handleDisconnect}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <div>
      <button onClick={handleConnect} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
*/

// ============================================================================
// Example 6: Protected Route
// ============================================================================

/*
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthService } from '@/services/auth.service';

function ProtectedPage() {
  const router = useRouter();

  useEffect(() => {
    const authService = getAuthService();

    // Check if user is authenticated
    if (!authService.isAuthenticated()) {
      // Redirect to home page
      router.push('/');
    }
  }, [router]);

  return (
    <div>
      <h1>Protected Content</h1>
      <p>Only authenticated users can see this.</p>
    </div>
  );
}
*/

// ============================================================================
// Example 7: Making Authenticated API Requests
// ============================================================================

/*
import { getApiClient } from '@/services/api-client.service';
import { getAuthService } from '@/services/auth.service';

async function fetchUserPortfolio() {
  const authService = getAuthService();
  
  // Check authentication
  if (!authService.isAuthenticated()) {
    throw new Error('User is not authenticated');
  }

  const state = authService.getAuthState();
  const address = state.address;

  // API Client automatically includes auth headers from localStorage
  const apiClient = getApiClient();
  const response = await apiClient.get(`/api/portfolio/${address}`);

  return response.data;
}
*/

// ============================================================================
// Example 8: Error Handling
// ============================================================================

async function connectWithErrorHandling() {
  const authService = getAuthService();
  
  try {
    const result = await authService.connect(WalletProvider.METAMASK);
    
    if (!result.success) {
      // Handle specific error cases
      if (result.error?.includes('not installed')) {
        // Show installation instructions
        console.log('Please install MetaMask');
        // window.open('https://metamask.io/download/', '_blank');
      } else if (result.error?.includes('rejected')) {
        // User rejected the request
        console.log('Connection was rejected by user');
      } else {
        // Generic error
        console.error('Connection failed:', result.error);
      }
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// ============================================================================
// Example 9: Multiple Wallet Support
// ============================================================================

async function connectToWallet(provider: WalletProvider) {
  const authService = getAuthService();
  
  // Disconnect current wallet if connected
  if (authService.isAuthenticated()) {
    await authService.disconnect();
  }
  
  // Connect to new wallet
  const result = await authService.connect(provider);
  
  return result;
}

// Usage:
// await connectToWallet(WalletProvider.METAMASK);
// await connectToWallet(WalletProvider.SUBWALLET);
// await connectToWallet(WalletProvider.TALISMAN);

// ============================================================================
// Example 10: Listening to Authentication State Changes
// ============================================================================

/*
import { useEffect, useState } from 'react';
import { getAuthService } from '@/services/auth.service';

function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const authService = getAuthService();
    
    // Check initial state
    const state = authService.getAuthState();
    setIsAuthenticated(state.isConnected);
    setAddress(state.address);

    // Poll for state changes (or use event emitter in future)
    const interval = setInterval(() => {
      const currentState = authService.getAuthState();
      setIsAuthenticated(currentState.isConnected);
      setAddress(currentState.address);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { isAuthenticated, address };
}
*/

// Export examples (not actually used, just for documentation)
export {
  connectWallet,
  initializeAuth,
  disconnectWallet,
  checkAuthStatus,
  connectWithErrorHandling,
  connectToWallet,
};
