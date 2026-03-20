'use client';

import dynamic from 'next/dynamic';

// Dynamically import ChatInterface with no SSR to avoid API client initialization issues
const ChatInterface = dynamic(
  () => import('@/components/chat/chat-interface').then((mod) => ({ default: mod.ChatInterface })),
  { ssr: false }
);

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto">
      <ChatInterface />
    </div>
  );
}
