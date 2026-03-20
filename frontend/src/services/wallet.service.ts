/**
 * Wallet Service
 * 
 * Handles wallet provider detection, installation checks, and provider metadata.
 * Supports MetaMask, SubWallet, and Talisman wallet providers.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export enum WalletProvider {
  METAMASK = 'metamask',
  SUBWALLET = 'subwallet',
  TALISMAN = 'talisman',
}

export interface WalletProviderInfo {
  id: WalletProvider;
  name: string;
  icon: string;
  downloadUrl: string;
  isInstalled: boolean;
  provider?: any; // The actual provider object (window.ethereum, etc.)
}

export interface WalletDetectionResult {
  availableWallets: WalletProviderInfo[];
  installedWallets: WalletProviderInfo[];
  hasMultipleWallets: boolean;
}

// Extend Window interface for wallet providers
declare global {
  interface Window {
    ethereum?: any;
    SubWallet?: any;
    talismanEth?: any;
  }
}

// ============================================================================
// Constants
// ============================================================================

const WALLET_METADATA: Record<WalletProvider, Omit<WalletProviderInfo, 'isInstalled' | 'provider'>> = {
  [WalletProvider.METAMASK]: {
    id: WalletProvider.METAMASK,
    name: 'MetaMask',
    icon: '/icons/metamask.svg',
    downloadUrl: 'https://metamask.io/download/',
  },
  [WalletProvider.SUBWALLET]: {
    id: WalletProvider.SUBWALLET,
    name: 'SubWallet',
    icon: '/icons/subwallet.svg',
    downloadUrl: 'https://www.subwallet.app/download.html',
  },
  [WalletProvider.TALISMAN]: {
    id: WalletProvider.TALISMAN,
    name: 'Talisman',
    icon: '/icons/talisman.svg',
    downloadUrl: 'https://www.talisman.xyz/download',
  },
};

// ============================================================================
// Wallet Service Class
// ============================================================================

export class WalletService {
  /**
   * Detect all available wallet providers
   */
  detectWallets(): WalletDetectionResult {
    const availableWallets: WalletProviderInfo[] = [];

    // Check MetaMask
    const metamaskInfo = this.detectMetaMask();
    availableWallets.push(metamaskInfo);

    // Check SubWallet
    const subwalletInfo = this.detectSubWallet();
    availableWallets.push(subwalletInfo);

    // Check Talisman
    const talismanInfo = this.detectTalisman();
    availableWallets.push(talismanInfo);

    const installedWallets = availableWallets.filter((w) => w.isInstalled);

    return {
      availableWallets,
      installedWallets,
      hasMultipleWallets: installedWallets.length > 1,
    };
  }

  /**
   * Check if a specific wallet provider is installed
   */
  isWalletInstalled(provider: WalletProvider): boolean {
    switch (provider) {
      case WalletProvider.METAMASK:
        return this.isMetaMaskInstalled();
      case WalletProvider.SUBWALLET:
        return this.isSubWalletInstalled();
      case WalletProvider.TALISMAN:
        return this.isTalismanInstalled();
      default:
        return false;
    }
  }

  /**
   * Get wallet provider information
   */
  getWalletInfo(provider: WalletProvider): WalletProviderInfo {
    const metadata = WALLET_METADATA[provider];
    const isInstalled = this.isWalletInstalled(provider);
    const providerObject = this.getProviderObject(provider);

    return {
      ...metadata,
      isInstalled,
      provider: providerObject,
    };
  }

  /**
   * Get all installed wallets
   */
  getInstalledWallets(): WalletProviderInfo[] {
    return this.detectWallets().installedWallets;
  }

  /**
   * Get wallet provider icon URL
   */
  getWalletIcon(provider: WalletProvider): string {
    return WALLET_METADATA[provider].icon;
  }

  /**
   * Get wallet provider download URL
   */
  getWalletDownloadUrl(provider: WalletProvider): string {
    return WALLET_METADATA[provider].downloadUrl;
  }

  /**
   * Get the provider object for a specific wallet
   */
  getProviderObject(provider: WalletProvider): any {
    if (typeof window === 'undefined') {
      return undefined;
    }

    switch (provider) {
      case WalletProvider.METAMASK:
        return this.getMetaMaskProvider();
      case WalletProvider.SUBWALLET:
        return this.getSubWalletProvider();
      case WalletProvider.TALISMAN:
        return this.getTalismanProvider();
      default:
        return undefined;
    }
  }

  // ==========================================================================
  // MetaMask Detection
  // ==========================================================================

  private detectMetaMask(): WalletProviderInfo {
    const metadata = WALLET_METADATA[WalletProvider.METAMASK];
    const isInstalled = this.isMetaMaskInstalled();
    const provider = this.getMetaMaskProvider();

    return {
      ...metadata,
      isInstalled,
      provider,
    };
  }

  private isMetaMaskInstalled(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return Boolean(
      window.ethereum &&
      (window.ethereum.isMetaMask || window.ethereum.providers?.some((p: any) => p.isMetaMask))
    );
  }

  private getMetaMaskProvider(): any {
    if (typeof window === 'undefined' || !window.ethereum) {
      return undefined;
    }

    // Handle multiple providers (e.g., MetaMask + other wallets)
    if (window.ethereum.providers) {
      return window.ethereum.providers.find((p: any) => p.isMetaMask);
    }

    // Single provider
    if (window.ethereum.isMetaMask) {
      return window.ethereum;
    }

    return undefined;
  }

  // ==========================================================================
  // SubWallet Detection
  // ==========================================================================

  private detectSubWallet(): WalletProviderInfo {
    const metadata = WALLET_METADATA[WalletProvider.SUBWALLET];
    const isInstalled = this.isSubWalletInstalled();
    const provider = this.getSubWalletProvider();

    return {
      ...metadata,
      isInstalled,
      provider,
    };
  }

  private isSubWalletInstalled(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return Boolean(
      window.SubWallet ||
      (window.ethereum && (window.ethereum.isSubWallet || window.ethereum.providers?.some((p: any) => p.isSubWallet)))
    );
  }

  private getSubWalletProvider(): any {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (window.SubWallet) return window.SubWallet;

    if (window.ethereum?.providers) {
      return window.ethereum.providers.find((p: any) => p.isSubWallet);
    }

    if (window.ethereum?.isSubWallet) return window.ethereum;

    return undefined;
  }

  // ==========================================================================
  // Talisman Detection
  // ==========================================================================

  private detectTalisman(): WalletProviderInfo {
    const metadata = WALLET_METADATA[WalletProvider.TALISMAN];
    const isInstalled = this.isTalismanInstalled();
    const provider = this.getTalismanProvider();

    return {
      ...metadata,
      isInstalled,
      provider,
    };
  }

  private isTalismanInstalled(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return Boolean(
      window.talismanEth ||
      (window.ethereum && (window.ethereum.isTalisman || window.ethereum.providers?.some((p: any) => p.isTalisman)))
    );
  }

  private getTalismanProvider(): any {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (window.talismanEth) return window.talismanEth;

    if (window.ethereum?.providers) {
      return window.ethereum.providers.find((p: any) => p.isTalisman);
    }

    if (window.ethereum?.isTalisman) return window.ethereum;

    return undefined;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Wait for wallet provider to be injected (useful for page load)
   */
  async waitForProvider(
    provider: WalletProvider,
    timeout: number = 3000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isWalletInstalled(provider)) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * Get user-friendly error message for wallet connection issues
   */
  getWalletErrorMessage(provider: WalletProvider, error: any): string {
    if (!this.isWalletInstalled(provider)) {
      const walletName = WALLET_METADATA[provider].name;
      return `${walletName} is not installed. Please install it to continue.`;
    }

    if (error.code === 4001) {
      return 'Connection request was rejected. Please try again.';
    }

    if (error.code === -32002) {
      return 'Connection request is already pending. Please check your wallet.';
    }

    if (error.message) {
      return error.message;
    }

    return 'Failed to connect to wallet. Please try again.';
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let walletServiceInstance: WalletService | null = null;

export function createWalletService(): WalletService {
  walletServiceInstance = new WalletService();
  return walletServiceInstance;
}

export function getWalletService(): WalletService {
  if (!walletServiceInstance) {
    walletServiceInstance = new WalletService();
  }
  return walletServiceInstance;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick check if any wallet is installed
 */
export function hasAnyWalletInstalled(): boolean {
  const service = getWalletService();
  return service.getInstalledWallets().length > 0;
}

/**
 * Get the first installed wallet (useful for auto-connect)
 */
export function getFirstInstalledWallet(): WalletProviderInfo | undefined {
  const service = getWalletService();
  return service.getInstalledWallets()[0];
}

/**
 * Check if multiple wallets are installed
 */
export function hasMultipleWallets(): boolean {
  const service = getWalletService();
  return service.getInstalledWallets().length > 1;
}
