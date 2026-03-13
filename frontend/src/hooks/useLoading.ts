'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/Toast';

interface UseLoadingOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  showToasts?: boolean;
}

export const useLoading = (options: UseLoadingOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { success, error: errorToast } = useToast();

  const execute = useCallback(async <T>(
    asyncFunction: () => Promise<T>,
    customOptions?: Partial<UseLoadingOptions>
  ): Promise<T | null> => {
    const opts = { ...options, ...customOptions };
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await asyncFunction();
      
      if (opts.onSuccess) {
        opts.onSuccess(result);
      }
      
      if (opts.showToasts !== false && opts.successMessage) {
        success('Success', opts.successMessage);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      setError(error);
      
      if (opts.onError) {
        opts.onError(error);
      }
      
      if (opts.showToasts !== false) {
        const message = opts.errorMessage || error.message;
        errorToast('Error', message);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [options, success, errorToast]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    execute,
    reset,
  };
};

// Specialized hooks for common operations
export const useAsyncOperation = () => {
  return useLoading({
    showToasts: true,
  });
};

export const useTransactionLoading = () => {
  const { transactionRejected } = useToast();
  
  return useLoading({
    onError: (error) => {
      // Handle user rejection gracefully (requirement 16.9)
      if (error.message.includes('user rejected') || 
          error.message.includes('User denied') ||
          error.message.includes('cancelled')) {
        transactionRejected();
      }
    },
    showToasts: false, // Handle toasts manually for transactions
  });
};

export const useApiLoading = () => {
  return useLoading({
    onError: (error) => {
      console.error('API Error:', error);
    },
    showToasts: true,
  });
};