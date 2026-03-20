"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "@/hooks/use-wallet";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/contexts/auth-context";
import { PortfolioProvider } from "@/contexts/portfolio-context";
import { ChatProvider } from "@/contexts/chat-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { queryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <WalletProvider>
                <PortfolioProvider>
                  <ChatProvider>
                    {children}
                  </ChatProvider>
                </PortfolioProvider>
              </WalletProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}