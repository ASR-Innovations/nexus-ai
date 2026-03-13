import { AgentLeaderboard } from "@/components/agent-leaderboard";
import { Header } from "@/components/header";

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AgentLeaderboard />
    </div>
  );
}