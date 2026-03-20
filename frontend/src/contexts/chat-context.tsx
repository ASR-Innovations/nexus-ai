"use client";

import { createContext, useContext, useCallback, useMemo, ReactNode, useState } from "react";
import { Message, Strategy } from "@/types";
import { getApiClient } from "@/services/api-client.service";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

interface ChatState {
  messages: Message[];
  conversationId: string | null;
  isProcessing: boolean;
  error: string | null;
  activeIntents: Map<number, IntentTracking>;
}

interface IntentTracking {
  intentId: number;
  status: string;
  strategy: Strategy;
}

interface ChatContextType extends ChatState {
  sendMessage: (content: string, userId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  trackIntent: (intentId: number, strategy: Strategy) => void;
  updateIntentStatus: (intentId: number, status: string) => void;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    conversationId: null,
    isProcessing: false,
    error: null,
    activeIntents: new Map()
  });

  const sendMessage = useCallback(async (content: string, userId: string) => {
    // Add user message immediately
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isProcessing: true,
      error: null
    }));

    try {
      const apiClient = getApiClient();
      const response = await apiClient.post<{ message?: string; strategies?: Strategy[]; conversationId?: string }>(
        API_ENDPOINTS.CHAT_MESSAGE,
        {
          message: content,
          userId,
          conversationId: state.conversationId
        }
      );

      const data = response.data;

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || '',
        strategies: data.strategies || [],
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        conversationId: data.conversationId || prev.conversationId,
        isProcessing: false
      }));
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send message';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [state.conversationId]);

  const addMessage = useCallback((message: Message) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      conversationId: null
    }));
  }, []);

  const trackIntent = useCallback((intentId: number, strategy: Strategy) => {
    setState(prev => {
      const newActiveIntents = new Map(prev.activeIntents);
      newActiveIntents.set(intentId, {
        intentId,
        status: 'PENDING',
        strategy
      });

      return {
        ...prev,
        activeIntents: newActiveIntents
      };
    });
  }, []);

  const updateIntentStatus = useCallback((intentId: number, status: string) => {
    setState(prev => {
      const newActiveIntents = new Map(prev.activeIntents);
      const tracking = newActiveIntents.get(intentId);

      if (tracking) {
        newActiveIntents.set(intentId, {
          ...tracking,
          status
        });
      }

      return {
        ...prev,
        activeIntents: newActiveIntents
      };
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value = useMemo<ChatContextType>(() => ({
    ...state,
    sendMessage,
    addMessage,
    clearMessages,
    trackIntent,
    updateIntentStatus,
    clearError
  }), [state, sendMessage, addMessage, clearMessages, trackIntent, updateIntentStatus, clearError]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
