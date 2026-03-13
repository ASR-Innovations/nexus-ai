'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  persistent?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (title: string, message?: string, options?: Partial<Toast>) => string;
  error: (title: string, message?: string, options?: Partial<Toast>) => string;
  warning: (title: string, message?: string, options?: Partial<Toast>) => string;
  info: (title: string, message?: string, options?: Partial<Toast>) => string;
  transactionRejected: (message?: string) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after duration (unless persistent)
    if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, [removeToast]);

  const success = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: 'success',
      title,
      message,
      ...options,
    });
  }, [addToast]);

  const error = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: 'error',
      title,
      message,
      duration: 8000, // Longer duration for errors
      ...options,
    });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: 'warning',
      title,
      message,
      duration: 6000,
      ...options,
    });
  }, [addToast]);

  const info = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: 'info',
      title,
      message,
      ...options,
    });
  }, [addToast]);

  const transactionRejected = useCallback((message?: string) => {
    return addToast({
      type: 'info', // Use info type, not error, as per requirement 16.9
      title: 'Transaction Cancelled',
      message: message || 'You cancelled the transaction.',
      duration: 4000,
    });
  }, [addToast]);

  const value: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    transactionRejected,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-yellow-500';
      case 'info':
        return 'border-blue-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.3 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
      className={`bg-gray-800 border-l-4 ${getBorderColor()} rounded-lg shadow-lg p-4 relative`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-white">
            {toast.title}
          </p>
          
          {toast.message && (
            <p className="mt-1 text-sm text-gray-300">
              {toast.message}
            </p>
          )}
          
          {toast.action && (
            <div className="mt-3">
              <button
                onClick={toast.action.onClick}
                className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>
        
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={onRemove}
            className="inline-flex text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Utility functions for common toast patterns
export const toastUtils = {
  // Transaction-related toasts
  transactionSent: (txHash: string, explorerUrl?: string) => {
    const { success } = useToast();
    return success(
      'Transaction Sent',
      'Your transaction has been submitted to the network.',
      {
        action: explorerUrl ? {
          label: 'View on Explorer',
          onClick: () => window.open(`${explorerUrl}/tx/${txHash}`, '_blank'),
        } : undefined,
      }
    );
  },

  transactionConfirmed: (message?: string) => {
    const { success } = useToast();
    return success(
      'Transaction Confirmed',
      message || 'Your transaction has been confirmed on-chain.'
    );
  },

  transactionFailed: (error: string, actionable?: string) => {
    const { error: errorToast } = useToast();
    return errorToast(
      'Transaction Failed',
      actionable || error,
      { persistent: true }
    );
  },

  // Network-related toasts
  networkError: (action?: () => void) => {
    const { error } = useToast();
    return error(
      'Network Error',
      'Unable to connect to the network. Please check your connection.',
      {
        action: action ? {
          label: 'Retry',
          onClick: action,
        } : undefined,
      }
    );
  },

  // Wallet-related toasts
  walletConnected: (address: string) => {
    const { success } = useToast();
    return success(
      'Wallet Connected',
      `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`
    );
  },

  walletDisconnected: () => {
    const { info } = useToast();
    return info('Wallet Disconnected', 'Your wallet has been disconnected.');
  },

  // API-related toasts
  apiError: (message: string, retry?: () => void) => {
    const { error } = useToast();
    return error(
      'Service Error',
      message,
      {
        action: retry ? {
          label: 'Retry',
          onClick: retry,
        } : undefined,
      }
    );
  },

  // Loading states
  loading: (message: string) => {
    const { info } = useToast();
    return info('Loading', message, { persistent: true });
  },
};