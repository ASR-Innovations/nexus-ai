"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ethers } from "ethers";

interface WalletContextType {
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const POLKADOT_HUB_CONFIG = {
  chainId: "0x190F1B41", // 420420417 decimal (Polkadot Hub Testnet / Paseo)
  chainName: "Polkadot Hub Testnet (Paseo)",
  nativeCurrency: {
    name: "PAS",
    symbol: "PAS",
    decimals: 18,
  },
  rpcUrls: ["https://eth-rpc-testnet.polkadot.io/"],
  blockExplorerUrls: ["https://assethub-paseo.subscan.io"],
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = !!address && !!provider && !!signer;

  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMask or compatible wallet not found");
    }

    setIsConnecting(true);
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      
      const walletSigner = await browserProvider.getSigner();
      const walletAddress = await walletSigner.getAddress();

      setProvider(browserProvider);
      setSigner(walletSigner);
      setAddress(walletAddress);

      // Check if we're on the correct network
      const network = await browserProvider.getNetwork();
      if (network.chainId !== BigInt(420420417)) {
        await switchNetwork();
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: POLKADOT_HUB_CONFIG.chainId }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [POLKADOT_HUB_CONFIG],
          });
        } catch (addError) {
          console.error("Failed to add network:", addError);
          throw addError;
        }
      } else {
        console.error("Failed to switch network:", switchError);
        throw switchError;
      }
    }
  };

  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });
          if (accounts.length > 0) {
            await connect();
          }
        } catch (error) {
          console.error("Auto-connect failed:", error);
        }
      }
    };

    autoConnect();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else if (accounts[0] !== address) {
          connect();
        }
      };

      const handleChainChanged = () => {
        // Reload the page when chain changes
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum?.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [address]);

  const value: WalletContextType = {
    address,
    provider,
    signer,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    switchNetwork,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}