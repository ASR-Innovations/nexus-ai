import { AgentDetail } from "@/components/agent-detail";
import { Header } from "@/components/header";

interface AgentDetailPageProps {
  params: Promise<{ address: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { address } = await params;
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AgentDetail address={address} />
    </div>
  );
}