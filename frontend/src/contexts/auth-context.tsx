"use client";

import { createContext, useContext, useCallback, useMemo, ReactNode, useState, useEffect } from "react";
import { getAuthService, WalletProvider, AuthState as ServiceAuthState } from "@/services/auth.service";
import { createApiClient, getApiClient } from "@/services/api-client.service";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export { WalletProvider } from "@/services/auth.service";

export interface AuthState extends ServiceAuthState {}

interface AuthContextType extends AuthState {
  connect: (provider: WalletProvider) => Promise<void>;
  disconnect: () => Promise<void>;
  reAuthenticate: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authService = getAuthService();
  
  const [state, setState] = useState<AuthState>(authService.getAuthState());

  // Initialize authentication on mount
  useEffect(() => {
    const initialize = async () => {
      // Ensure API client is initialized before auth
      try { getApiClient(); } catch { createApiClient(API_BASE_URL); }
      await authService.initializeAuth();
      setState(authService.getAuthState());
    };

    initialize();
  }, []);

  const connect = useCallback(async (provider: WalletProvider) => {
    try {
      const result = await authService.connect(provider);
      setState(authService.getAuthState());
      
      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error: any) {
      setState(authService.getAuthState());
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await authService.disconnect();
    setState(authService.getAuthState());
  }, []);

  const reAuthenticate = useCallback(async () => {
    const result = await authService.reAuthenticate();
    setState(authService.getAuthState());
    
    if (!result.success) {
      throw new Error(result.error || 'Re-authentication failed');
    }
  }, []);

  const clearError = useCallback(() => {
    // Get current state and clear error
    const currentState = authService.getAuthState();
    setState({ ...currentState, error: null });
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    ...state,
    connect,
    disconnect,
    reAuthenticate,
    clearError
  }), [state, connect, disconnect, reAuthenticate, clearError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
