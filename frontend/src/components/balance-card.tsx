"use client";

import { Balance } from "@/types";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  balances: Balance[];
  className?: string;
}

export function BalanceCard({ balances, className }: BalanceCardProps) {
  // Group balances by asset
  const groupedBalances = balances.reduce((acc, balance) => {
    if (!acc[balance.asset]) {
      acc[balance.asset] = [];
    }
    acc[balance.asset].push(balance);
    return acc;
  }, {} as Record<string, Balance[]>);

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num === 0) return "0";
    if (num < 0.001) return "< 0.001";
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(3);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatUsdValue = (value: number) => {
    if (value === 0) return "$0.00";
    if (value < 0.01) return "< $0.01";
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (Object.keys(groupedBalances).length === 0) {
    return (
      <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
        <h2 className="text-lg font-semibold mb-4">Balances</h2>
        <div className="text-center py-8 text-muted-foreground">
          No balances found. Connect to supported chains to view your assets.
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
      <h2 className="text-lg font-semibold mb-4">Balances</h2>
      <div className="space-y-4">
        {Object.entries(groupedBalances).map(([asset, assetBalances]) => {
          const totalAmount = assetBalances.reduce((sum, balance) => sum + parseFloat(balance.amount), 0);
          const totalValue = assetBalances.reduce((sum, balance) => sum + balance.valueUsd, 0);

          return (
            <div key={asset} className="border border-border/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {asset.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{asset}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatAmount(totalAmount.toString())} {asset}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatUsdValue(totalValue)}</p>
                  <p className="text-sm text-muted-foreground">
                    {assetBalances.length} chain{assetBalances.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Chain breakdown */}
              {assetBalances.length > 1 && (
                <div className="space-y-2 pt-3 border-t border-border/30">
                  {assetBalances.map((balance, index) => (
                    <div key={`${balance.chain}-${index}`} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-muted rounded-full" />
                        <span className="text-muted-foreground">{balance.chain}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{formatAmount(balance.amount)} {balance.asset}</span>
                        <span className="text-muted-foreground">
                          {formatUsdValue(balance.valueUsd)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}