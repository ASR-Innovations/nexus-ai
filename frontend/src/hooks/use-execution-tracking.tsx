'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ExecutionUpdate } from '@/types';

interface UseExecutionTrackingOptions {
  intentId: number;
  userId: string;
  onUpdate?: (update: ExecutionUpdate) => void;
  onError?: (error: Error) => void;
}

interface ExecutionTrackingState {
  updates: ExecutionUpdate[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastUpdate: ExecutionUpdate | null;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function useExecutionTracking({
  intentId,
  userId,
  onUpdate,
  onError
}: UseExecutionTrackingOptions): ExecutionTrackingState {
  const [state, setState] = useState<ExecutionTrackingState>({
    updates: [],
    isConnected: false,
    isConnecting: false,
    error: null,
    lastUpdate: null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const isUnmountedRef = useRef(false);

  const addUpdate = useCallback((update: ExecutionUpdate) => {
    setState(prev => ({
      ...prev,
      updates: [...prev.updates, update],
      lastUpdate: update,
      error: null
    }));
    onUpdate?.(update);
  }, [onUpdate]);

  const setError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      error,
      isConnected: false,
      isConnecting: false
    }));
    onError?.(new Error(error));
  }, [onError]);

  const setConnected = useCallback((connected: boolean) => {
    setState(prev => ({
      ...prev,
      isConnected: connected,
      isConnecting: false,
      error: connected ? null : prev.error
    }));
  }, []);

  const setConnecting = useCallback((connecting: boolean) => {
    setState(prev => ({
      ...prev,
      isConnecting: connecting
    }));
  }, []);

  const connect = useCallback(() => {
    if (isUnmountedRef.current || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnecting(true);

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }

        console.log('WebSocket connected for intent:', intentId);
        setConnected(true);
        
        // Reset reconnection state on successful connection
        reconnectAttemptsRef.current = 0;
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;

        // Subscribe to intent updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          intentId,
          userId
        }));
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          
          // Only process updates for our intent
          if (data.intentId === intentId) {
            addUpdate(data as ExecutionUpdate);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          setError('Failed to parse server message');
        }
      };

      ws.onclose = (event) => {
        if (isUnmountedRef.current) return;

        console.log('WebSocket closed for intent:', intentId, 'Code:', event.code);
        setConnected(false);

        // Don't reconnect if it was a normal closure or if we've exceeded max attempts
        if (event.code === 1000 || reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          return;
        }

        // Schedule reconnection with exponential backoff
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        if (isUnmountedRef.current) return;

        console.error('WebSocket error for intent:', intentId, error);
        setError('Connection error occurred');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('Failed to establish connection');
      scheduleReconnect();
    }
  }, [intentId, userId, addUpdate, setError, setConnected, setConnecting]);

  const scheduleReconnect = useCallback(() => {
    if (isUnmountedRef.current || reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(reconnectDelayRef.current, MAX_RECONNECT_DELAY);
    
    console.log(`Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isUnmountedRef.current) {
        connect();
      }
    }, delay);

    // Exponential backoff with jitter
    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * 2 + Math.random() * 1000,
      MAX_RECONNECT_DELAY
    );
  }, [connect]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Send unsubscribe message before closing
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe',
          intentId
        }));
      }
      
      wsRef.current.close(1000, 'Component unmounting');
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnected(false);
  }, [intentId, setConnected]);

  // Connect on mount and when intentId changes
  useEffect(() => {
    connect();

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  return state;
}