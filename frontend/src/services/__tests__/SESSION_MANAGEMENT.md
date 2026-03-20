# Session Management and Auto-Reconnection

This document describes the session management and auto-reconnection features implemented in Task 7.3.

## Features Implemented

### 1. Automatic Re-authentication on Page Load

The `initializeAuth()` method automatically restores the user's session when the page loads:

```typescript
// Called automatically by AuthProvider on mount
await authService.initializeAuth();
```

**How it works:**
- Checks localStorage for stored credentials (address, signature, nonce, provider)
- If found, verifies them with the backend via `reAuthenticate()`
- If verification succeeds, restores the authenticated state
- Sets up account change listener for the restored session
- If verification fails, clears invalid credentials

### 2. Account Change Detection

The service automatically detects when the user switches accounts in their wallet:

```typescript
// Automatically set up after successful connection
private setupAccountChangeListener(provider: WalletProvider): void
```

**How it works:**
- Listens to the `accountsChanged` event from the wallet provider
- When accounts change:
  - If no accounts (wallet locked): disconnects the user
  - If different account: clears old credentials and re-authenticates with new account
  - If same account: no action needed

### 3. Cleanup on Disconnect

The `disconnect()` method now properly cleans up event listeners:

```typescript
await authService.disconnect();
```

**How it works:**
- Removes the `accountsChanged` event listener
- Clears all credentials from localStorage
- Resets the authentication state

## Usage in Application

### In AuthProvider (Context)

The AuthProvider automatically initializes authentication on mount:

```typescript
useEffect(() => {
  const initialize = async () => {
    await authService.initializeAuth();
    setState(authService.getAuthState());
  };

  initialize();
}, []);
```

### User Flow

1. **First Visit:**
   - User clicks "Connect Wallet"
   - Authenticates with wallet signature
   - Credentials stored in localStorage
   - Account change listener set up

2. **Page Reload:**
   - `initializeAuth()` called automatically
   - Stored credentials verified with backend
   - Session restored without user interaction
   - Account change listener re-established

3. **Account Switch:**
   - User switches account in wallet
   - `accountsChanged` event fired
   - Old credentials cleared
   - New authentication flow triggered automatically

4. **Wallet Lock:**
   - User locks wallet
   - `accountsChanged` event fired with empty accounts
   - User automatically disconnected
   - Credentials cleared

5. **Manual Disconnect:**
   - User clicks "Disconnect"
   - Event listener removed
   - Credentials cleared
   - State reset

## Requirements Satisfied

- **Requirement 1.6:** Automatic re-authentication on page reload ✓
- **Requirement 1.8:** Account change detection and re-authentication ✓
- **Requirement 1.9:** Proper credential cleanup on disconnect ✓

## Testing

All functionality is covered by unit tests in `auth.service.test.ts`:

- ✓ Initialize auth with valid stored credentials
- ✓ Initialize auth with no stored credentials
- ✓ Initialize auth with invalid stored credentials
- ✓ Set up account change listener after connection
- ✓ Disconnect when wallet is locked
- ✓ Re-authenticate when account changes
- ✓ Clean up listener on disconnect

Run tests with:
```bash
npm test -- auth.service.test.ts
```

## Implementation Notes

### Error Handling

- All errors are caught and logged, but don't throw to prevent app crashes
- Invalid credentials are automatically cleared
- Failed re-authentication doesn't block the app

### Browser Compatibility

- Uses localStorage (supported in all modern browsers)
- Gracefully handles missing wallet providers
- Works with MetaMask, SubWallet, and Talisman

### Security

- Credentials are only stored in localStorage (never in memory long-term)
- Signatures are verified with backend on every page load
- Invalid credentials are immediately cleared
- Event listeners are properly cleaned up to prevent memory leaks
