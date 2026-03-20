# Global State Management

This directory contains the global state management contexts for the NexusAI Protocol frontend application.

## Overview

The application uses React Context API for global state management, providing four main contexts:

1. **AuthContext** - Wallet authentication and session management
2. **PortfolioContext** - Portfolio data, balances, and yield positions
3. **ChatContext** - Conversation history and intent tracking
4. **ThemeContext** - Light/dark mode preferences

Each context follows best practices:
- Memoization to prevent unnecessary re-renders
- TypeScript types for all state slices
- Loading and error states
- Action functions (mutations)
- localStorage persistence where appropriate

## Contexts

### AuthContext

Manages wallet connection, nonce-based signature authentication, and user session.

**Location**: `src/contexts/auth-context.tsx`

**State**:
```typescript
interface AuthState {
  isConnected: boolean;
  isAuthenticating: boolean;
  address: string | null;
  signature: string | null;
  nonce: string | null;
  provider: WalletProvider | null;
  error: string | null;
}
```

**Actions**:
- `connect(provider: WalletProvider)` - Connect to a wallet provider
- `disconnect()` - Disconnect and clear session
- `reAuthenticate()` - Re-authenticate using stored credentials
- `clearError()` - Clear error state

**Usage**:
```typescript
import { useAuth, WalletProvider } from '@/hooks';

function MyComponent() {
  const { isConnected, address, connect, disconnect } = useAuth();

  const handleConnect = async () => {
    try {
      await connect(WalletProvider.METAMASK);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  return (
    <div>
      {isConnected ? (
        <button onClick={disconnect}>Disconnect {address}</button>
      ) : (
        <button onClick={handleConnect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

**Features**:
- Automatic re-authentication on page reload
- Account change detection
- localStorage persistence
- Nonce-based signature verification

---

### PortfolioContext

Manages portfolio data including balances, yield positions, and transaction history.

**Location**: `src/contexts/portfolio-context.tsx`

**State**:
```typescript
interface PortfolioState {
  portfolio: Portfolio | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}
```

**Actions**:
- `fetchPortfolio(address: string)` - Fetch complete portfolio overview
- `refreshPortfolio(address: string)` - Force refresh portfolio data
- `clearError()` - Clear error state

**Usage**:
```typescript
import { usePortfolio } from '@/hooks';

function PortfolioView() {
  const { portfolio, isLoading, fetchPortfolio, refreshPortfolio } = usePortfolio();
  const { address } = useAuth();

  useEffect(() => {
    if (address) {
      fetchPortfolio(address);
    }
  }, [address]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Total Value: ${portfolio?.totalValueUsd}</h1>
      <button onClick={() => refreshPortfolio(address!)}>Refresh</button>
    </div>
  );
}
```

**Features**:
- Automatic refresh every 30 seconds
- Staleness detection (data older than 60 seconds)
- In-memory caching (30 seconds)
- Visibility-based auto-refresh (pauses when tab is hidden)

---

### ChatContext

Manages conversation history, message processing, and active intent tracking.

**Location**: `src/contexts/chat-context.tsx`

**State**:
```typescript
interface ChatState {
  messages: Message[];
  conversationId: string | null;
  isProcessing: boolean;
  error: string | null;
  activeIntents: Map<number, IntentTracking>;
}
```

**Actions**:
- `sendMessage(content: string, userId: string)` - Send chat message
- `addMessage(message: Message)` - Add message to history
- `clearMessages()` - Clear conversation history
- `trackIntent(intentId: number, strategy: Strategy)` - Track intent execution
- `updateIntentStatus(intentId: number, status: string)` - Update intent status
- `clearError()` - Clear error state

**Usage**:
```typescript
import { useChat } from '@/hooks';

function ChatInterface() {
  const { messages, isProcessing, sendMessage } = useChat();
  const { address } = useAuth();
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!address || !input.trim()) return;

    try {
      await sendMessage(input, address);
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div>
      <div>
        {messages.map((msg, i) => (
          <div key={i}>{msg.content}</div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isProcessing}
      />
      <button onClick={handleSend} disabled={isProcessing}>
        Send
      </button>
    </div>
  );
}
```

**Features**:
- Conversation context management
- Intent tracking with status updates
- Optimistic UI updates
- Strategy recommendation handling

---

### ThemeContext

Manages light/dark mode preferences with system preference detection.

**Location**: `src/contexts/theme-context.tsx`

**State**:
```typescript
interface ThemeState {
  theme: 'light' | 'dark';
  isLoading: boolean;
}
```

**Actions**:
- `setTheme(theme: Theme)` - Set theme explicitly
- `toggleTheme()` - Toggle between light and dark

**Usage**:
```typescript
import { useTheme } from '@/hooks';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

**Features**:
- System preference detection
- localStorage persistence
- Automatic dark class application to document root
- System preference change listener

---

## TanStack Query Configuration

The application uses TanStack Query (React Query) for server state management with optimized defaults.

**Location**: `src/lib/query-client.ts`

**Configuration**:
```typescript
{
  queries: {
    staleTime: 30000,        // 30 seconds
    gcTime: 300000,          // 5 minutes
    retry: 3,                // Retry 3 times
    retryDelay: exponential, // 1s, 2s, 4s, 8s...
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    refetchOnReconnect: false,
  },
  mutations: {
    retry: 1,
    retryDelay: exponential,
  }
}
```

**Usage with Contexts**:
```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks';

function usePortfolioQuery() {
  const { address } = useAuth();

  return useQuery({
    queryKey: ['portfolio', address],
    queryFn: () => fetchPortfolio(address!),
    enabled: !!address,
    staleTime: 30000,
    refetchInterval: 30000,
  });
}
```

---

## Provider Setup

All contexts are wrapped in the main `Providers` component.

**Location**: `src/components/providers.tsx`

**Provider Hierarchy**:
```
ErrorBoundary
└── QueryClientProvider
    └── ThemeProvider
        └── ToastProvider
            └── AuthProvider
                └── WalletProvider
                    └── PortfolioProvider
                        └── ChatProvider
```

**Usage in App**:
```typescript
// app/layout.tsx
import { Providers } from '@/components/providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

---

## Best Practices

### 1. Memoization

All contexts use `useMemo` and `useCallback` to prevent unnecessary re-renders:

```typescript
const value = useMemo<AuthContextType>(() => ({
  ...state,
  connect,
  disconnect,
  reAuthenticate,
  clearError
}), [state, connect, disconnect, reAuthenticate, clearError]);
```

### 2. Error Handling

All async actions include try-catch blocks and set error state:

```typescript
try {
  // Perform action
  setState({ ...prev, error: null });
} catch (error: any) {
  setState({ ...prev, error: error.message });
  throw error; // Re-throw for component handling
}
```

### 3. Loading States

Separate loading states for initial load and refresh:

```typescript
interface State {
  isLoading: boolean;    // Initial load
  isRefreshing: boolean; // Background refresh
}
```

### 4. localStorage Persistence

Only persist non-sensitive data:

```typescript
// ✅ Safe to persist
localStorage.setItem('wallet_address', address);
localStorage.setItem('theme', 'dark');

// ❌ Never persist
// localStorage.setItem('private_key', key);
```

### 5. Cleanup

Always clean up side effects:

```typescript
useEffect(() => {
  const interval = setInterval(refresh, 30000);
  return () => clearInterval(interval);
}, [refresh]);
```

---

## Testing

Each context has comprehensive unit tests in `__tests__/` directory.

**Run tests**:
```bash
npm test -- --testPathPatterns="contexts/__tests__"
```

**Test coverage**:
- Initial state
- Action functions
- Error handling
- localStorage persistence
- Side effects (intervals, listeners)

---

## Migration Guide

### From old useWallet hook to AuthContext

**Before**:
```typescript
import { useWallet } from '@/hooks/use-wallet';

const { address, connect, disconnect } = useWallet();
```

**After**:
```typescript
import { useAuth, WalletProvider } from '@/hooks';

const { address, connect, disconnect } = useAuth();

// Note: connect now requires provider parameter
await connect(WalletProvider.METAMASK);
```

### From old usePortfolio hook to PortfolioContext

**Before**:
```typescript
import { usePortfolio } from '@/hooks/use-portfolio';

const { data, isLoading } = usePortfolio({ address });
```

**After**:
```typescript
import { usePortfolio } from '@/hooks';

const { portfolio, isLoading, fetchPortfolio } = usePortfolio();

useEffect(() => {
  if (address) fetchPortfolio(address);
}, [address]);
```

---

## Future Enhancements

1. **WebSocket Integration**: Real-time updates for portfolio and execution status
2. **Optimistic Updates**: Update UI before server confirmation
3. **Offline Support**: Queue actions when offline, sync when online
4. **State Persistence**: Persist more state to localStorage/IndexedDB
5. **Redux DevTools**: Add Redux DevTools integration for debugging
