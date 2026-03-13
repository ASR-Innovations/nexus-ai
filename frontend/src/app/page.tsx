import { ChatInterface } from "@/components/chat-interface";
import { Header } from "@/components/header";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <ChatInterface />
    </div>
  );
}
