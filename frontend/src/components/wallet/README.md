# Wallet Connector Component

A comprehensive wallet connection UI component that supports multiple wallet providers (MetaMask, SubWallet, and Talisman).

## Features

- **Multi-Wallet Support**: Supports MetaMask, SubWallet, and Talisman wallet providers
- **Wallet Detection**: Automatically detects installed wallet extensions
- **Installation Guidance**: Shows installation instructions and links for wallets that aren't installed
- **Connection Flow**: Handles the complete authentication flow using nonce-based signature verification
- **Loading States**: Displays loading indicators during connection process
- **Error Handling**: Shows toast notifications for connection errors
- **Connected State**: Displays truncated wallet address with provider icon when connected
- **Disconnect Functionality**: Allows users to disconnect their wallet
- **Responsive Design**: Works on all screen sizes

## Usage

```tsx
import { WalletConnector } from '@/components/wallet/wallet-connector';

function MyComponent() {
  return <WalletConnector />;
}
```

## Component States

### Disconnected State
- Shows "Connect Wallet" button
- Opens wallet selection dialog when clicked
- Displays loading state during authentication

### Connected State
- Shows truncated wallet address (e.g., "0x1234...5678")
- Displays wallet provider icon
- Shows green connection indicator
- Provides "Disconnect" button

## Wallet Selection Dialog

The wallet selection dialog displays:
- All available wallet providers (MetaMask, SubWallet, Talisman)
- Installation status for each wallet
- "Install" link for wallets that aren't installed
- Loading state during connection attempt

## Dependencies

- `@/contexts/auth-context` - Authentication context with useAuth hook
- `@/services/wallet.service` - Wallet detection and provider management
- `@/components/ui/button` - Button component
- `@/components/ui/modal` - Modal dialog component
- `@/components/Toast` - Toast notification system
- `lucide-react` - Icons

## Authentication Flow

1. User clicks "Connect Wallet" button
2. Wallet selection dialog opens
3. User selects a wallet provider
4. If wallet is not installed, opens installation URL
5. If wallet is installed:
   - Requests account access from wallet
   - Requests nonce from backend
   - Requests signature from wallet
   - Verifies signature with backend
   - Stores credentials in localStorage
   - Updates UI to connected state

## Error Handling

The component handles various error scenarios:
- Wallet not installed
- User rejection of connection request
- User rejection of signature request
- Network errors
- Backend verification failures

All errors are displayed as toast notifications with user-friendly messages.

## Testing

The component includes comprehensive unit tests covering:
- Disconnected state rendering
- Connected state rendering
- Wallet selection dialog
- Connection flow
- Error handling
- Installation flow

Run tests with:
```bash
npm test -- wallet-connector.test.tsx
```

## Styling

The component uses the project's design system with:
- Light/dark mode support
- Consistent spacing and typography
- Smooth animations and transitions
- Accessible color contrast

## Requirements Satisfied

This component satisfies the following requirements from the frontend-overhaul spec:
- **1.1**: Wallet connection UI
- **1.7**: Multi-wallet support
- **1.10**: Error handling with toast notifications
- **28.4-28.5**: Wallet provider detection and selection
- **28.10**: Installation instructions for missing wallets
