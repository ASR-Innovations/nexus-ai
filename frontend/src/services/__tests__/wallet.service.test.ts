/**
 * Wallet Service Tests
 * 
 * Tests for wallet provider detection, installation checks, and metadata.
 */

import {
  WalletService,
  WalletProvider,
  createWalletService,
  getWalletService,
  hasAnyWalletInstalled,
  getFirstInstalledWallet,
  hasMultipleWallets,
} from '../wallet.service';

// ============================================================================
// Test Setup
// ============================================================================

describe('WalletService', () => {
  let walletService: WalletService;

  beforeEach(() => {
    walletService = new WalletService();
    
    // Clear window.ethereum and other wallet providers
    delete (window as any).ethereum;
    delete (window as any).SubWallet;
    delete (window as any).talismanEth;
  });

  // ==========================================================================
  // MetaMask Detection Tests
  // ==========================================================================

  describe('MetaMask Detection', () => {
    it('should detect MetaMask when installed', () => {
      // Mock MetaMask
      (window as any).ethereum = {
        isMetaMask: true,
        request: jest.fn(),
      };

      const result = walletService.isWalletInstalled(WalletProvider.METAMASK);
      expect(result).toBe(true);
    });

    it('should detect MetaMask in providers array', () => {
      // Mock multiple providers with MetaMask
      (window as any).ethereum = {
        providers: [
          { isMetaMask: true, request: jest.fn() },
          { isCoinbaseWallet: true, request: jest.fn() },
        ],
      };

      const result = walletService.isWalletInstalled(WalletProvider.METAMASK);
      expect(result).toBe(true);
    });

    it('should return false when MetaMask is not installed', () => {
      const result = walletService.isWalletInstalled(WalletProvider.METAMASK);
      expect(result).toBe(false);
    });

    it('should get MetaMask provider object', () => {
      const mockProvider = {
        isMetaMask: true,
        request: jest.fn(),
      };
      (window as any).ethereum = mockProvider;

      const provider = walletService.getProviderObject(WalletProvider.METAMASK);
      expect(provider).toBe(mockProvider);
    });

    it('should get MetaMask from providers array', () => {
      const mockMetaMask = { isMetaMask: true, request: jest.fn() };
      (window as any).ethereum = {
        providers: [
          mockMetaMask,
          { isCoinbaseWallet: true, request: jest.fn() },
        ],
      };

      const provider = walletService.getProviderObject(WalletProvider.METAMASK);
      expect(provider).toBe(mockMetaMask);
    });
  });

  // ==========================================================================
  // SubWallet Detection Tests
  // ==========================================================================

  describe('SubWallet Detection', () => {
    it('should detect SubWallet when installed', () => {
      (window as any).SubWallet = {
        request: jest.fn(),
      };

      const result = walletService.isWalletInstalled(WalletProvider.SUBWALLET);
      expect(result).toBe(true);
    });

    it('should return false when SubWallet is not installed', () => {
      const result = walletService.isWalletInstalled(WalletProvider.SUBWALLET);
      expect(result).toBe(false);
    });

    it('should get SubWallet provider object', () => {
      const mockProvider = { request: jest.fn() };
      (window as any).SubWallet = mockProvider;

      const provider = walletService.getProviderObject(WalletProvider.SUBWALLET);
      expect(provider).toBe(mockProvider);
    });
  });

  // ==========================================================================
  // Talisman Detection Tests
  // ==========================================================================

  describe('Talisman Detection', () => {
    it('should detect Talisman when installed', () => {
      (window as any).talismanEth = {
        request: jest.fn(),
      };

      const result = walletService.isWalletInstalled(WalletProvider.TALISMAN);
      expect(result).toBe(true);
    });

    it('should return false when Talisman is not installed', () => {
      const result = walletService.isWalletInstalled(WalletProvider.TALISMAN);
      expect(result).toBe(false);
    });

    it('should get Talisman provider object', () => {
      const mockProvider = { request: jest.fn() };
      (window as any).talismanEth = mockProvider;

      const provider = walletService.getProviderObject(WalletProvider.TALISMAN);
      expect(provider).toBe(mockProvider);
    });
  });

  // ==========================================================================
  // Wallet Detection Tests
  // ==========================================================================

  describe('detectWallets', () => {
    it('should detect all installed wallets', () => {
      // Install all wallets
      (window as any).ethereum = { isMetaMask: true };
      (window as any).SubWallet = { request: jest.fn() };
      (window as any).talismanEth = { request: jest.fn() };

      const result = walletService.detectWallets();

      expect(result.availableWallets).toHaveLength(3);
      expect(result.installedWallets).toHaveLength(3);
      expect(result.hasMultipleWallets).toBe(true);
    });

    it('should detect only installed wallets', () => {
      // Install only MetaMask
      (window as any).ethereum = { isMetaMask: true };

      const result = walletService.detectWallets();

      expect(result.availableWallets).toHaveLength(3);
      expect(result.installedWallets).toHaveLength(1);
      expect(result.installedWallets[0].id).toBe(WalletProvider.METAMASK);
      expect(result.hasMultipleWallets).toBe(false);
    });

    it('should return empty installed wallets when none are installed', () => {
      const result = walletService.detectWallets();

      expect(result.availableWallets).toHaveLength(3);
      expect(result.installedWallets).toHaveLength(0);
      expect(result.hasMultipleWallets).toBe(false);
    });
  });

  // ==========================================================================
  // Wallet Info Tests
  // ==========================================================================

  describe('getWalletInfo', () => {
    it('should return wallet info with installation status', () => {
      (window as any).ethereum = { isMetaMask: true };

      const info = walletService.getWalletInfo(WalletProvider.METAMASK);

      expect(info.id).toBe(WalletProvider.METAMASK);
      expect(info.name).toBe('MetaMask');
      expect(info.icon).toBe('/icons/metamask.svg');
      expect(info.downloadUrl).toBe('https://metamask.io/download/');
      expect(info.isInstalled).toBe(true);
      expect(info.provider).toBeDefined();
    });

    it('should return wallet info when not installed', () => {
      const info = walletService.getWalletInfo(WalletProvider.SUBWALLET);

      expect(info.id).toBe(WalletProvider.SUBWALLET);
      expect(info.name).toBe('SubWallet');
      expect(info.isInstalled).toBe(false);
      expect(info.provider).toBeUndefined();
    });
  });

  // ==========================================================================
  // Utility Method Tests
  // ==========================================================================

  describe('getInstalledWallets', () => {
    it('should return all installed wallets', () => {
      (window as any).ethereum = { isMetaMask: true };
      (window as any).SubWallet = { request: jest.fn() };

      const installed = walletService.getInstalledWallets();

      expect(installed).toHaveLength(2);
      expect(installed[0].id).toBe(WalletProvider.METAMASK);
      expect(installed[1].id).toBe(WalletProvider.SUBWALLET);
    });
  });

  describe('getWalletIcon', () => {
    it('should return correct icon URL for each wallet', () => {
      expect(walletService.getWalletIcon(WalletProvider.METAMASK)).toBe('/icons/metamask.svg');
      expect(walletService.getWalletIcon(WalletProvider.SUBWALLET)).toBe('/icons/subwallet.svg');
      expect(walletService.getWalletIcon(WalletProvider.TALISMAN)).toBe('/icons/talisman.svg');
    });
  });

  describe('getWalletDownloadUrl', () => {
    it('should return correct download URL for each wallet', () => {
      expect(walletService.getWalletDownloadUrl(WalletProvider.METAMASK)).toBe('https://metamask.io/download/');
      expect(walletService.getWalletDownloadUrl(WalletProvider.SUBWALLET)).toBe('https://www.subwallet.app/download.html');
      expect(walletService.getWalletDownloadUrl(WalletProvider.TALISMAN)).toBe('https://www.talisman.xyz/download');
    });
  });

  describe('getWalletErrorMessage', () => {
    it('should return installation message when wallet is not installed', () => {
      const message = walletService.getWalletErrorMessage(WalletProvider.METAMASK, {});
      expect(message).toContain('MetaMask is not installed');
    });

    it('should return rejection message for code 4001', () => {
      (window as any).ethereum = { isMetaMask: true };
      const message = walletService.getWalletErrorMessage(WalletProvider.METAMASK, { code: 4001 });
      expect(message).toContain('rejected');
    });

    it('should return pending message for code -32002', () => {
      (window as any).ethereum = { isMetaMask: true };
      const message = walletService.getWalletErrorMessage(WalletProvider.METAMASK, { code: -32002 });
      expect(message).toContain('already pending');
    });

    it('should return error message when provided', () => {
      (window as any).ethereum = { isMetaMask: true };
      const message = walletService.getWalletErrorMessage(WalletProvider.METAMASK, { message: 'Custom error' });
      expect(message).toBe('Custom error');
    });

    it('should return generic message for unknown errors', () => {
      (window as any).ethereum = { isMetaMask: true };
      const message = walletService.getWalletErrorMessage(WalletProvider.METAMASK, {});
      expect(message).toContain('Failed to connect');
    });
  });

  describe('waitForProvider', () => {
    it('should resolve immediately if provider is already installed', async () => {
      (window as any).ethereum = { isMetaMask: true };

      const result = await walletService.waitForProvider(WalletProvider.METAMASK, 1000);
      expect(result).toBe(true);
    });

    it('should timeout if provider is not installed', async () => {
      const result = await walletService.waitForProvider(WalletProvider.METAMASK, 500);
      expect(result).toBe(false);
    }, 1000);

    it('should detect provider when it becomes available', async () => {
      // Simulate provider being injected after 200ms
      setTimeout(() => {
        (window as any).ethereum = { isMetaMask: true };
      }, 200);

      const result = await walletService.waitForProvider(WalletProvider.METAMASK, 1000);
      expect(result).toBe(true);
    }, 1500);
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe('Singleton Functions', () => {
    it('should create wallet service instance', () => {
      const service = createWalletService();
      expect(service).toBeInstanceOf(WalletService);
    });

    it('should return same instance from getWalletService', () => {
      const service1 = getWalletService();
      const service2 = getWalletService();
      expect(service1).toBe(service2);
    });
  });

  // ==========================================================================
  // Convenience Function Tests
  // ==========================================================================

  describe('Convenience Functions', () => {
    beforeEach(() => {
      // Reset singleton
      (getWalletService as any).walletServiceInstance = null;
    });

    it('hasAnyWalletInstalled should return true when wallet is installed', () => {
      (window as any).ethereum = { isMetaMask: true };
      expect(hasAnyWalletInstalled()).toBe(true);
    });

    it('hasAnyWalletInstalled should return false when no wallet is installed', () => {
      expect(hasAnyWalletInstalled()).toBe(false);
    });

    it('getFirstInstalledWallet should return first installed wallet', () => {
      (window as any).ethereum = { isMetaMask: true };
      const wallet = getFirstInstalledWallet();
      expect(wallet?.id).toBe(WalletProvider.METAMASK);
    });

    it('getFirstInstalledWallet should return undefined when no wallet is installed', () => {
      const wallet = getFirstInstalledWallet();
      expect(wallet).toBeUndefined();
    });

    it('hasMultipleWallets should return true when multiple wallets are installed', () => {
      (window as any).ethereum = { isMetaMask: true };
      (window as any).SubWallet = { request: jest.fn() };
      expect(hasMultipleWallets()).toBe(true);
    });

    it('hasMultipleWallets should return false when only one wallet is installed', () => {
      (window as any).ethereum = { isMetaMask: true };
      expect(hasMultipleWallets()).toBe(false);
    });
  });
});
