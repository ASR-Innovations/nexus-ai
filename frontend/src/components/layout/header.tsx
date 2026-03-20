"use client";

import Link from "next/link";
import { Navigation } from "./navigation";
import { WalletConnector } from "../wallet-connector";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link 
          href="/" 
          className="flex items-center space-x-2 transition-opacity hover:opacity-80"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-primary to-primary/60">
            <span className="text-lg font-bold text-primary-foreground">N</span>
          </div>
          <span className="hidden font-semibold sm:inline-block text-foreground">
            NexusAI Protocol
          </span>
        </Link>

        {/* Desktop Navigation */}
        <Navigation />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletConnector />
        </div>
      </div>
    </header>
  );
}
