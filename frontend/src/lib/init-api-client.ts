/**
 * API Client Initialization
 *
 * The API client now initializes lazily on first use.
 * This file is kept for explicit initialization if custom config is needed.
 */

import { createApiClient } from '@/services/api-client.service';
import { getAuthService } from '@/services/auth.service';

const API_BASE_URL = '/api';

export function initializeApiClient(): void {
  const handleReAuthRequired = async () => {
    const authService = getAuthService();
    const result = await authService.reAuthenticate();
    if (!result.success) {
      throw new Error(result.error || 'Re-authentication failed');
    }
  };

  createApiClient(API_BASE_URL, handleReAuthRequired);
}
