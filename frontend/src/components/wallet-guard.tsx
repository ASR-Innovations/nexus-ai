"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface WalletGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function WalletGuard({ children, redirectTo = "/" }: WalletGuardProps) {
  const { address, isConnecting } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!isConnecting && !address) {
      router.push(redirectTo);
    }
  }, [address, isConnecting, router, redirectTo]);

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  if (!address) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}