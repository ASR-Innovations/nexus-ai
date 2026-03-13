"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useState } from "react";

export function WalletConnector() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setError(null);
      await connect();
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setError(null);
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-secondary-foreground">
            {truncateAddress(address)}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {isConnecting ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
            Connecting...
          </>
        ) : (
          "Connect Wallet"
        )}
      </button>
      {error && (
        <p className="text-sm text-destructive max-w-xs text-right">
          {error}
        </p>
      )}
    </div>
  );
}