import { WalletAuthGuard, WalletSignature } from '../guards/wallet-auth.guard';

/**
 * Utility functions for wallet authentication
 * These can be used by frontend developers to create proper authentication
 */

/**
 * Create a standardized authentication message for wallet signing
 * This should be used by the frontend to create the message that users sign
 */
export function createAuthMessage(walletAddress: string, timestamp?: number): string {
  return WalletAuthGuard.createAuthMessage(walletAddress, timestamp);
}

/**
 * Create a Bearer token from signature data
 * This can be used by the frontend to create the Authorization header
 */
export function createBearerToken(signatureData: WalletSignature): string {
  return WalletAuthGuard.createBearerToken(signatureData);
}

/**
 * Validate signature data structure
 * This can be used by the frontend to validate signature data before sending
 */
export function validateSignatureData(data: any): data is WalletSignature {
  return (
    data &&
    typeof data.address === 'string' &&
    typeof data.signature === 'string' &&
    typeof data.message === 'string' &&
    typeof data.timestamp === 'number' &&
    data.address.match(/^0x[a-fA-F0-9]{40}$/) !== null
  );
}

/**
 * Create signature data object for API requests
 */
export function createSignatureData(
  address: string,
  signature: string,
  message: string,
  timestamp: number
): WalletSignature {
  return {
    address,
    signature,
    message,
    timestamp,
  };
}

/**
 * Example usage for frontend developers:
 * 
 * ```typescript
 * // 1. Create message to sign
 * const timestamp = Math.floor(Date.now() / 1000);
 * const message = createAuthMessage(walletAddress, timestamp);
 * 
 * // 2. Request user to sign the message
 * const signature = await signer.signMessage(message);
 * 
 * // 3. Create signature data
 * const signatureData = createSignatureData(walletAddress, signature, message, timestamp);
 * 
 * // 4. Create Bearer token
 * const bearerToken = createBearerToken(signatureData);
 * 
 * // 5. Use in API requests
 * const response = await fetch('/api/intent/create', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${bearerToken}`,
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify(requestData),
 * });
 * ```
 * 
 * Alternative methods:
 * 
 * ```typescript
 * // Method 1: Custom headers
 * const response = await fetch('/api/intent/create', {
 *   method: 'POST',
 *   headers: {
 *     'x-wallet-address': signatureData.address,
 *     'x-wallet-signature': signatureData.signature,
 *     'x-wallet-message': signatureData.message,
 *     'x-wallet-timestamp': signatureData.timestamp.toString(),
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify(requestData),
 * });
 * 
 * // Method 2: Include in request body
 * const response = await fetch('/api/intent/create', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({
 *     ...requestData,
 *     address: signatureData.address,
 *     signature: signatureData.signature,
 *     message: signatureData.message,
 *     timestamp: signatureData.timestamp,
 *   }),
 * });
 * ```
 */

/**
 * Check if a timestamp is still valid (within 5 minutes)
 */
export function isTimestampValid(timestamp: number): boolean {
  const now = Date.now();
  const signatureTime = timestamp * 1000; // Convert to milliseconds if needed
  
  // Handle both seconds and milliseconds timestamps
  const actualSignatureTime = signatureTime > now ? timestamp : signatureTime;
  
  const timeDiff = Math.abs(now - actualSignatureTime);
  const SIGNATURE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
  
  return timeDiff <= SIGNATURE_VALIDITY_MS;
}

/**
 * Get current timestamp in seconds (for signature creation)
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}