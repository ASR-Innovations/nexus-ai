'use client';

import { useState } from 'react';
import { useAuth, WalletProvider } from '@/contexts/auth-context';
import { getWalletService, WalletProviderInfo } from '@/services/wallet.service';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/Toast';
import { ExternalLink, Wallet, ChevronDown } from 'lucide-react';

/**
 * Wallet Connector Component
 * 
 * Displays wallet connection UI with support for MetaMask, SubWallet, and Talisman.
 * Shows wallet selection dialog, handles connection flow, and displays connected state.
 */
export function WalletConnector() {
  const { isConnected, isAuthenticating, address, provider, connect, disconnect, error } = useAuth();
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const walletService = getWalletService();
  const wallets = walletService.detectWallets();

  /**
   * Truncate wallet address to format: 0x1234...5678
   */
  const truncateAddress = (addr: string): string => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  /**
   * Handle wallet connection
   */
  const handleConnect = async (walletProvider: WalletProvider) => {
    setIsConnecting(true);
    
    try {
      await connect(walletProvider);
      setIsDialogOpen(false);
      showSuccessToast('Wallet Connected', `Connected to ${truncateAddress(address || '')}`);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect wallet';
      showErrorToast('Connection Failed', errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Handle wallet disconnection
   */
  const handleDisconnect = async () => {
    try {
      await disconnect();
      showSuccessToast('Wallet Disconnected', 'Your wallet has been disconnected');
    } catch (err: any) {
      showErrorToast('Disconnect Failed', err.message || 'Failed to disconnect wallet');
    }
  };

  /**
   * Get wallet icon component
   */
  const getWalletIcon = (walletProvider: WalletProvider) => {
    // For now, use a generic wallet icon
    // In production, you would use actual wallet logos
    return <Wallet className="h-5 w-5" />;
  };

  /**
   * Get current wallet info
   */
  const getCurrentWalletInfo = (): WalletProviderInfo | null => {
    if (!provider) return null;
    return walletService.getWalletInfo(provider);
  };

  // Connected state
  if (isConnected && address) {
    const currentWallet = getCurrentWalletInfo();
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary border border-light-border dark:border-dark-border">
          {currentWallet && (
            <div className="flex items-center justify-center w-5 h-5">
              {getWalletIcon(currentWallet.id)}
            </div>
          )}
          <span className="text-label-sm font-medium text-light-textPrimary dark:text-dark-textPrimary">
            {truncateAddress(address)}
          </span>
          <div className="w-2 h-2 bg-green-500 rounded-full" />
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // Disconnected state
  return (
    <>
      <Button
        variant="primary"
        size="md"
        onClick={() => setIsDialogOpen(true)}
        isLoading={isAuthenticating}
      >
        <Wallet className="h-4 w-4 mr-2" />
        Connect Wallet
      </Button>

      <WalletSelectionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        wallets={wallets.availableWallets}
        onConnect={handleConnect}
        isConnecting={isConnecting}
      />
    </>
  );
}

/**
 * Wallet Selection Dialog Component
 */
interface WalletSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: WalletProviderInfo[];
  onConnect: (provider: WalletProvider) => Promise<void>;
  isConnecting: boolean;
}

function WalletSelectionDialog({
  open,
  onOpenChange,
  wallets,
  onConnect,
  isConnecting,
}: WalletSelectionDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Connect Wallet"
      description="Choose a wallet to connect to the application"
    >
      <div className="space-y-3 mt-4">
        {wallets.map((wallet) => (
          <WalletOption
            key={wallet.id}
            wallet={wallet}
            onConnect={onConnect}
            isConnecting={isConnecting}
          />
        ))}
      </div>

      {isConnecting && (
        <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <p className="text-body-sm text-yellow-800 dark:text-yellow-300 font-medium">
            👆 Check your wallet extension — a popup may be waiting for your approval.
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
        <p className="text-body-sm text-light-textSecondary dark:text-dark-textSecondary">
          By connecting your wallet, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </Modal>
  );
}

/**
 * Individual Wallet Option Component
 */
interface WalletOptionProps {
  wallet: WalletProviderInfo;
  onConnect: (provider: WalletProvider) => Promise<void>;
  isConnecting: boolean;
}

function WalletOption({ wallet, onConnect, isConnecting }: WalletOptionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'requesting' | 'signing'>('idle');

  const handleClick = async () => {
    if (!wallet.isInstalled) {
      window.open(wallet.downloadUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setIsLoading(true);
    setStep('requesting');
    try {
      // Brief delay so UI updates before wallet popup blocks
      await new Promise(resolve => setTimeout(resolve, 50));
      setStep('signing');
      await onConnect(wallet.id);
    } finally {
      setIsLoading(false);
      setStep('idle');
    }
  };

  const stepLabel = step === 'requesting'
    ? 'Approve in wallet…'
    : step === 'signing'
    ? 'Sign message in wallet…'
    : 'Connecting…';

  return (
    <button
      onClick={handleClick}
      disabled={(isConnecting && !isLoading) || isLoading}
      className="w-full flex items-center justify-between p-4 rounded-lg border border-light-border dark:border-dark-border hover:bg-light-surfaceHover dark:hover:bg-dark-surfaceHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-light-backgroundSecondary dark:bg-dark-backgroundSecondary">
          <Wallet className="h-6 w-6 text-light-textPrimary dark:text-dark-textPrimary" />
        </div>
        
        <div className="text-left">
          <div className="text-label-md font-medium text-light-textPrimary dark:text-dark-textPrimary">
            {wallet.name}
          </div>
          
          {!wallet.isInstalled && (
            <div className="flex items-center gap-1 mt-1 text-body-sm text-light-textSecondary dark:text-dark-textSecondary">
              <span>Not installed</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>

      {wallet.isInstalled ? (
        isLoading ? (
          <div className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-light-textSecondary dark:text-dark-textSecondary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-body-sm text-light-textSecondary dark:text-dark-textSecondary">
              {stepLabel}
            </span>
          </div>
        ) : (
          <ChevronDown className="h-5 w-5 text-light-textSecondary dark:text-dark-textSecondary -rotate-90" />
        )
      ) : (
        <span className="text-body-sm text-light-primary dark:text-dark-primary font-medium">
          Install
        </span>
      )}
    </button>
  );
}
