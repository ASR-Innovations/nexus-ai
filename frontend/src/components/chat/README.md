# Chat Components

This directory contains chat-related components for the NexusAI Protocol frontend.

## Components

### ChatInput

A fully-featured chat input component with multi-line support, suggested prompts, and accessibility features.

#### Features

- **Multi-line text input** with auto-resize (min 56px, max 200px)
- **Keyboard shortcuts**: Enter to submit, Shift+Enter for new line
- **Suggested prompts** displayed when chat is empty
- **Character count indicator** with visual feedback
- **"Thinking..." indicator** while processing
- **Glass morphism design** with Apple-inspired styling
- **Smooth animations** using Framer Motion
- **Full accessibility** with ARIA labels and keyboard navigation
- **Responsive design** for mobile, tablet, and desktop

#### Usage

```tsx
import { ChatInput } from '@/components/chat/chat-input';

function MyChat() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendMessage = async (message: string) => {
    setIsProcessing(true);
    try {
      // Send message to backend
      await sendMessageToAPI(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ChatInput
      onSendMessage={handleSendMessage}
      isProcessing={isProcessing}
      placeholder="Describe your DeFi goals..."
      showSuggestedPrompts={true}
      maxCharacters={2000}
    />
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSendMessage` | `(message: string) => void` | Required | Callback when user sends a message |
| `isProcessing` | `boolean` | `false` | Shows "Thinking..." indicator and disables input |
| `disabled` | `boolean` | `false` | Disables the input completely |
| `placeholder` | `string` | `"Describe your DeFi goals..."` | Placeholder text for the input |
| `showSuggestedPrompts` | `boolean` | `true` | Shows suggested prompts when input is empty |
| `maxCharacters` | `number` | `2000` | Maximum character limit |

#### Accessibility

- Full keyboard navigation support
- ARIA labels for screen readers
- Visual focus indicators
- Status announcements for character count
- Disabled state properly communicated

#### Design Tokens

The component uses design tokens from `@/styles/design-tokens.ts`:

- Colors: Primary, surface, text, border colors with light/dark mode support
- Typography: Body text styles
- Spacing: Consistent padding and margins
- Animations: Smooth transitions and motion effects
- Border radius: Rounded corners matching design system

### MessageList

Displays a list of chat messages with support for strategies, plan approvals, and execution confirmations.

#### Usage

```tsx
import { MessageList } from '@/components/chat/message-list';

function MyChat() {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <MessageList
      messages={messages}
      onApproveStrategy={(strategy) => console.log('Approve', strategy)}
      onRejectStrategy={() => console.log('Reject')}
      onApprovePlan={(intentId) => console.log('Approve plan', intentId)}
      onRejectPlan={(intentId) => console.log('Reject plan', intentId)}
      onExecute={(intentId) => console.log('Execute', intentId)}
    />
  );
}
```

## Testing

Both components have comprehensive test coverage:

```bash
# Run all chat component tests
npm test -- chat

# Run specific component tests
npm test -- chat-input.test.tsx
npm test -- message-list.test.tsx

# Run with coverage
npm test -- --coverage chat
```

## Integration Example

Here's a complete example of using both components together:

```tsx
'use client';

import { useState } from 'react';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { Message } from '@/types';

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Process message
    setIsProcessing(true);
    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });
      const data = await response.json();

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        strategies: data.strategies,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <MessageList messages={messages} />
      <ChatInput
        onSendMessage={handleSendMessage}
        isProcessing={isProcessing}
      />
    </div>
  );
}
```

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 6.8**: Frontend application displays suggested prompts when chat is empty ✓
- **Requirement 6.9**: Frontend application supports Shift+Enter for multi-line messages ✓

Additional features implemented:
- **Requirement 6.5**: "Thinking..." loading indicator during processing ✓
- Character count indicator for better UX ✓
- Auto-resize textarea for comfortable typing ✓
- Accessibility features for inclusive design ✓
