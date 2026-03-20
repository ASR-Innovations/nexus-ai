/**
 * API Client Service
 * 
 * Centralized HTTP client with:
 * - Automatic authentication header injection
 * - Retry logic with exponential backoff
 * - Rate limit handling
 * - Request deduplication
 * - Request cancellation support
 * - Error transformation
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RequestOptions {
  requiresAuth?: boolean;
  retries?: number;
  timeout?: number;
  signal?: AbortSignal;
  skipDeduplication?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  rateLimit?: RateLimitInfo;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  url?: string;
  retryable?: boolean;
}

interface InFlightRequest {
  promise: Promise<any>;
  timestamp: number;
}

interface AuthHeaders {
  'X-Wallet-Address': string;
  'X-Wallet-Signature': string;
  'X-Wallet-Message': string;
  'X-Wallet-Timestamp': string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s
const DEDUPLICATION_WINDOW = 500; // 500ms
const STORAGE_KEYS = {
  ADDRESS: 'wallet_address',
  SIGNATURE: 'wallet_signature',
  NONCE: 'wallet_nonce',
  TIMESTAMP: 'wallet_timestamp',
} as const;

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
  private baseUrl: string;
  private inFlightRequests: Map<string, InFlightRequest> = new Map();
  private rateLimitInfo: Map<string, RateLimitInfo> = new Map();
  private onReAuthRequired?: () => Promise<void>;

  constructor(baseUrl: string, onReAuthRequired?: () => Promise<void>) {
    this.baseUrl = baseUrl;
    this.onReAuthRequired = onReAuthRequired;
  }

  // ==========================================================================
  // Public HTTP Methods
  // ==========================================================================

  async get<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  async post<T>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, data, options);
  }

  async put<T>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, data, options);
  }

  async delete<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  async patch<T>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, data, options);
  }

  // ==========================================================================
  // Request Cancellation
  // ==========================================================================

  cancel(requestId: string): void {
    const inFlight = this.inFlightRequests.get(requestId);
    if (inFlight) {
      this.inFlightRequests.delete(requestId);
    }
  }

  // ==========================================================================
  // Rate Limit Info
  // ==========================================================================

  getRateLimitInfo(endpoint?: string): RateLimitInfo | undefined {
    if (endpoint) {
      return this.rateLimitInfo.get(endpoint);
    }
    // Return the most restrictive rate limit
    const limits = Array.from(this.rateLimitInfo.values());
    if (limits.length === 0) return undefined;
    return limits.reduce((min, curr) =>
      curr.remaining < min.remaining ? curr : min
    );
  }

  // ==========================================================================
  // Core Request Method
  // ==========================================================================

  private async request<T>(
    method: string,
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      requiresAuth = true,
      retries = DEFAULT_RETRIES,
      timeout = DEFAULT_TIMEOUT,
      signal,
      skipDeduplication = false,
    } = options;

    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    // Request deduplication
    if (!skipDeduplication && method === 'GET') {
      const dedupKey = this.getDeduplicationKey(method, fullUrl, data);
      const existing = this.inFlightRequests.get(dedupKey);

      if (existing && Date.now() - existing.timestamp < DEDUPLICATION_WINDOW) {
        return existing.promise;
      }
    }

    // Create request promise
    const requestPromise = this.executeRequest<T>(
      method,
      fullUrl,
      data,
      requiresAuth,
      retries,
      timeout,
      signal
    );

    // Store in-flight request for deduplication
    if (!skipDeduplication && method === 'GET') {
      const dedupKey = this.getDeduplicationKey(method, fullUrl, data);
      this.inFlightRequests.set(dedupKey, {
        promise: requestPromise,
        timestamp: Date.now(),
      });

      // Clean up after request completes
      requestPromise.finally(() => {
        this.inFlightRequests.delete(dedupKey);
      });
    }

    return requestPromise;
  }

  // ==========================================================================
  // Request Execution with Retry Logic
  // ==========================================================================

  private async executeRequest<T>(
    method: string,
    url: string,
    data: any,
    requiresAuth: boolean,
    retriesLeft: number,
    timeout: number,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    try {
      // Validate method
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      if (!validMethods.includes(method)) {
        throw new Error(`Invalid HTTP method: ${method}`);
      }

      // Validate URL
      if (!url || typeof url !== 'string') {
        throw new Error(`Invalid URL: ${url}`);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Combine signals if external signal provided
      let combinedSignal: AbortSignal;
      try {
        combinedSignal = signal
          ? this.combineAbortSignals([signal, controller.signal])
          : controller.signal;
          
        // Validate the signal
        if (combinedSignal && typeof combinedSignal.aborted !== 'boolean') {
          console.error('[API Client] Invalid abort signal:', combinedSignal);
          throw new Error('Invalid abort signal object');
        }
        
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('[API Client] Failed to combine abort signals:', error);
        throw new Error('Invalid abort signal');
      }

      // Build headers with the simplest possible approach
      const headers = new Headers();
      
      // Always add Content-Type for requests with body
      if (data !== undefined && data !== null) {
        headers.set('Content-Type', 'application/json');
      }

      // Add authentication headers if required and available
      if (requiresAuth) {
        const authHeaders = this.getAuthHeaders();
        
        // Only add auth headers if we have valid credentials
        Object.entries(authHeaders).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim() !== '') {
            // Check for newline characters (the root cause of "Invalid value" error)
            if (value.includes('\n') || value.includes('\r')) {
              console.warn(`[API Client] Found newline characters in header ${key} - this causes "Invalid value" error`);
              console.warn(`[API Client] Original value:`, JSON.stringify(value));
            }
            
            // CRITICAL: Remove newline characters from header values
            // Newline characters in headers cause "Invalid value" error in fetch
            const sanitizedValue = value.replace(/\n/g, ' ').replace(/\r/g, '').trim();
            headers.set(key, sanitizedValue);
            
            if (value !== sanitizedValue) {
              console.log(`[API Client] Sanitized header ${key}:`, JSON.stringify(sanitizedValue));
            }
          }
        });
      }

      // Log request details for debugging
      console.log('[API Client] Making request:', {
        method,
        url,
        headerCount: Array.from(headers.keys()).length,
        headerKeys: Array.from(headers.keys()),
        hasBody: !!data,
      });

      // Prepare body
      let body: string | undefined = undefined;
      if (data !== undefined && data !== null) {
        try {
          body = JSON.stringify(data);
        } catch (error) {
          console.error('[API Client] Failed to stringify request body:', error);
          throw new Error('Invalid request body - cannot stringify');
        }
      }

      // Create the simplest possible fetch options
      const fetchOptions: RequestInit = {
        method: method,
        headers: headers,
      };
      
      // Add body only if it exists
      if (body !== undefined) {
        fetchOptions.body = body;
      }
      
      // Add signal only if it exists and is valid
      if (combinedSignal && typeof combinedSignal.aborted === 'boolean') {
        fetchOptions.signal = combinedSignal;
      }

      console.log('[API Client] Fetch options prepared:', {
        method: fetchOptions.method,
        hasHeaders: !!fetchOptions.headers,
        hasBody: !!fetchOptions.body,
        hasSignal: !!fetchOptions.signal
      });

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      // Parse rate limit headers
      const rateLimit = this.parseRateLimitHeaders(response.headers);
      if (rateLimit) {
        // Extract endpoint path safely - handle both relative and absolute URLs
        let endpoint: string;
        try {
          // If url is absolute, use URL constructor
          endpoint = new URL(url).pathname;
        } catch {
          // If url is relative (like "/api/chat/message"), use it directly
          endpoint = url.startsWith('/') ? url : `/${url}`;
        }
        this.rateLimitInfo.set(endpoint, rateLimit);
      }

      // Handle 401 Unauthorized - trigger re-authentication
      if (response.status === 401 && requiresAuth && this.onReAuthRequired) {
        console.log('[API Client] 401 Unauthorized - triggering re-authentication');
        try {
          await this.onReAuthRequired();
          // Retry the request once after re-authentication
          return this.executeRequest<T>(
            method,
            url,
            data,
            requiresAuth,
            0, // No more retries after re-auth
            timeout,
            signal
          );
        } catch (reAuthError) {
          console.error('[API Client] Re-authentication failed:', reAuthError);
          // Re-auth failed — surface the original 401 error, not a confusing re-auth error
          const error = await this.createApiError(response, url);
          throw error;
        }
      }

      // Handle 429 Rate Limit - wait and retry
      if (response.status === 429 && retriesLeft > 0) {
        const resetTime = rateLimit?.reset || Date.now() / 1000 + 60;
        const waitTime = Math.max(0, resetTime * 1000 - Date.now());

        console.log(
          `[API Client] Rate limited. Waiting ${Math.ceil(waitTime / 1000)}s before retry`
        );

        await this.sleep(waitTime);

        return this.executeRequest<T>(
          method,
          url,
          data,
          requiresAuth,
          retriesLeft - 1,
          timeout,
          signal
        );
      }

      // Handle error responses
      if (!response.ok) {
        const error = await this.createApiError(response, url);
        
        // Retry 5xx server errors (but not 429, which is handled above)
        if (error.retryable && error.status !== 429 && retriesLeft > 0) {
          const retryAttempt = DEFAULT_RETRIES - retriesLeft;
          const delay = RETRY_DELAYS[retryAttempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

          console.log(
            `[API Client] Server error (${error.status}). Retrying in ${delay}ms (${retriesLeft} retries left)`
          );

          await this.sleep(delay);

          return this.executeRequest<T>(
            method,
            url,
            data,
            requiresAuth,
            retriesLeft - 1,
            timeout,
            signal
          );
        }
        
        throw error;
      }

      // Parse response
      const responseData = await response.json();

      return {
        data: responseData,
        status: response.status,
        headers: response.headers,
        rateLimit,
      };
    } catch (error: any) {
      // Handle network errors with retry
      if (this.isNetworkError(error) && retriesLeft > 0) {
        const retryAttempt = DEFAULT_RETRIES - retriesLeft;
        const delay = RETRY_DELAYS[retryAttempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

        console.log(
          `[API Client] Network error. Retrying in ${delay}ms (${retriesLeft} retries left)`
        );

        await this.sleep(delay);

        return this.executeRequest<T>(
          method,
          url,
          data,
          requiresAuth,
          retriesLeft - 1,
          timeout,
          signal
        );
      }

      // Transform and log error
      const apiError = this.transformError(error, url);
      this.logError(apiError, method, url, data);

      throw apiError;
    }
  }

  // ==========================================================================
  // Authentication Headers
  // ==========================================================================

  private getAuthHeaders(): Partial<AuthHeaders> {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const address = localStorage.getItem(STORAGE_KEYS.ADDRESS);
      const signature = localStorage.getItem(STORAGE_KEYS.SIGNATURE);
      const nonce = localStorage.getItem(STORAGE_KEYS.NONCE);
      const timestamp = localStorage.getItem(STORAGE_KEYS.TIMESTAMP);

      // Validate all values are present and are strings
      if (!address || !signature || !nonce || !timestamp) {
        // This is normal if user hasn't authenticated yet
        return {};
      }

      // Ensure all values are valid strings (not "null", "undefined", etc.)
      if (
        typeof address !== 'string' || address === 'null' || address === 'undefined' ||
        typeof signature !== 'string' || signature === 'null' || signature === 'undefined' ||
        typeof nonce !== 'string' || nonce === 'null' || nonce === 'undefined' ||
        typeof timestamp !== 'string' || timestamp === 'null' || timestamp === 'undefined'
      ) {
        return {};
      }

      return {
        'X-Wallet-Address': address,
        'X-Wallet-Signature': signature,
        'X-Wallet-Message': nonce,
        'X-Wallet-Timestamp': timestamp,
      };
    } catch (error) {
      console.error('[API Client] Error reading authentication credentials:', error);
      return {};
    }
  }

  // ==========================================================================
  // Rate Limit Parsing
  // ==========================================================================

  private parseRateLimitHeaders(headers: Headers): RateLimitInfo | undefined {
    const limit = headers.get('X-RateLimit-Limit');
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (!limit || !remaining || !reset) {
      return undefined;
    }

    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
    };
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  private async createApiError(response: Response, url: string): Promise<ApiError> {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let code = response.statusText;

    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error || message;
      code = errorData.code || code;
    } catch {
      // Failed to parse error response, use default message
    }

    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.code = code;
    error.url = url;
    error.retryable = this.isRetryableStatus(response.status);

    return error;
  }

  private transformError(error: any, url: string): ApiError {
    if (error.name === 'AbortError') {
      const apiError = new Error('Request timeout') as ApiError;
      apiError.code = 'TIMEOUT';
      apiError.url = url;
      apiError.retryable = true;
      return apiError;
    }

    if (this.isNetworkError(error)) {
      const apiError = new Error('Network error. Please check your connection.') as ApiError;
      apiError.code = 'NETWORK_ERROR';
      apiError.url = url;
      apiError.retryable = true;
      return apiError;
    }

    // Already an ApiError
    if ('status' in error) {
      return error;
    }

    // Generic error
    const apiError = new Error(error.message || 'An unexpected error occurred') as ApiError;
    apiError.url = url;
    apiError.retryable = false;
    return apiError;
  }

  private isNetworkError(error: any): boolean {
    // Only treat as network error if it's a fetch-level failure (no response received)
    // Don't treat re-auth errors or other TypeErrors as network errors
    if (error.code === 'NETWORK_ERROR') return true;
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') return true;
    if (error.name === 'TypeError' && (
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('network error') ||
      error.message?.includes('Load failed')
    )) return true;
    return false;
  }

  private isRetryableStatus(status: number): boolean {
    // Retry on 5xx server errors and 429 rate limit
    return status >= 500 || status === 429;
  }

  private logError(error: ApiError, method: string, url: string, data?: any): void {
    console.error(`[API Client] Request failed: ${method} ${url}`, {
      status: error.status,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      data: data ? JSON.stringify(data).substring(0, 100) : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private getDeduplicationKey(method: string, url: string, data?: any): string {
    const dataHash = data ? JSON.stringify(data) : '';
    return `${method}:${url}:${dataHash}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }

      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apiClientInstance: ApiClient | null = null;

export function createApiClient(
  baseUrl: string,
  onReAuthRequired?: () => Promise<void>
): ApiClient {
  apiClientInstance = new ApiClient(baseUrl, onReAuthRequired);
  return apiClientInstance;
}

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    // Lazy initialization — safe to call before explicit createApiClient
    initializeLazyApiClient();
  }
  return apiClientInstance!;
}

/**
 * Lazy initialization used when getApiClient() is called before createApiClient().
 * Uses a deferred import to avoid circular dependency issues.
 */
function initializeLazyApiClient(): void {
  const handleReAuthRequired = async () => {
    try {
      // Dynamic import to avoid circular dependency
      const { getAuthService } = await import('./auth.service');
      const authService = getAuthService();
      const result = await authService.reAuthenticate();
      if (!result.success) {
        throw new Error(result.error || 'Re-authentication failed');
      }
    } catch (error) {
      throw error;
    }
  };

  apiClientInstance = new ApiClient('/api', handleReAuthRequired);
}

// ============================================================================
// User-Friendly Error Messages
// ============================================================================

export function getUserFriendlyErrorMessage(error: ApiError): string {
  // Network errors
  if (error.code === 'NETWORK_ERROR') {
    return 'Network error. Please check your connection and try again.';
  }

  if (error.code === 'TIMEOUT') {
    return 'Request timed out. Please try again.';
  }

  // Authentication errors
  if (error.status === 401) {
    return 'Authentication failed. Please reconnect your wallet.';
  }

  if (error.status === 403) {
    return 'Access denied. You do not have permission to perform this action.';
  }

  // Client errors
  if (error.status === 400) {
    return error.message || 'Invalid request. Please check your input.';
  }

  if (error.status === 404) {
    return 'Resource not found.';
  }

  if (error.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Server errors
  if (error.status && error.status >= 500) {
    return 'Server error. Please try again later.';
  }

  // Default
  return error.message || 'An unexpected error occurred. Please try again.';
}
