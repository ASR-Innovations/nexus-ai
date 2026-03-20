/**
 * useApiClient Hook
 * 
 * React hook for accessing the API client with automatic re-authentication
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { createApiClient, getApiClient, ApiClient } from '@/services/api-client.service';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Hook to access the API client
 * 
 * Automatically initializes the API client with re-authentication callback
 * and provides access to the singleton instance
 */
export function useApiClient(): ApiClient {
  const { reAuthenticate } = useAuth();

  // Create re-authentication callback
  const handleReAuthRequired = useCallback(async () => {
    console.log('[useApiClient] Re-authentication required');
    try {
      await reAuthenticate();
    } catch (error) {
      console.error('[useApiClient] Re-authentication failed:', error);
      throw error;
    }
  }, [reAuthenticate]);

  // Initialize API client on mount
  useEffect(() => {
    try {
      // Try to get existing instance
      getApiClient();
    } catch {
      // Create new instance if it doesn't exist
      createApiClient(API_BASE_URL, handleReAuthRequired);
    }
  }, [handleReAuthRequired]);

  // Return the API client instance
  return useMemo(() => {
    try {
      return getApiClient();
    } catch {
      // Fallback: create instance if it doesn't exist
      return createApiClient(API_BASE_URL, handleReAuthRequired);
    }
  }, [handleReAuthRequired]);
}
