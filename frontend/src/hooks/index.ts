// Export all custom hooks from a single entry point
export { useAuth } from '@/contexts/auth-context';
export { usePortfolio } from '@/contexts/portfolio-context';
export { useChat } from '@/contexts/chat-context';
export { useTheme } from '@/contexts/theme-context';
export { useWallet } from './use-wallet';

// Re-export types
export { WalletProvider } from '@/contexts/auth-context';
export type { AuthState } from '@/contexts/auth-context';
