"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { WalletConnector } from "./wallet-connector";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/chat", label: "Chat" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/agents", label: "Agents" },
    { href: "/bot", label: "Bot Dashboard" },
  ];

  return (
    <header className="border-b border-border bg-card p-4">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center space-x-8">
          <Link href="/" className="text-2xl font-bold text-primary hover:text-primary/80 transition-colors">
            NexusAI Protocol
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          <WalletConnector />
          
          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 hover:bg-muted rounded-md transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-4 pb-4 border-t border-border">
          <nav className="flex flex-col space-y-2 max-w-6xl mx-auto pt-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors hover:text-primary hover:bg-muted rounded-md",
                  pathname === item.href
                    ? "text-primary bg-muted"
                    : "text-muted-foreground"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}