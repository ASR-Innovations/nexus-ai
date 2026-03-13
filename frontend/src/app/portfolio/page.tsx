import { PortfolioView } from "@/components/portfolio-view";
import { Header } from "@/components/header";
import { WalletGuard } from "@/components/wallet-guard";

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <WalletGuard>
        <PortfolioView />
      </WalletGuard>
    </div>
  );
}