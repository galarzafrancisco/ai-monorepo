import { useEffect } from 'react';
import type { Message } from './types';
import { sortMessages, useThreadData } from './useThreadData';
import { useThreadSocket } from './useThreadSocket';

/**
 * Main hook for thread interactions - orchestrates data fetching and WebSocket transport
 *
 * This hook composes:
 * - useThreadData: HTTP data fetching (thread metadata, messages)
 * - useThreadSocket: WebSocket connection and real-time events
 *
 * Benefits of this architecture:
 * - Each concern (transport, data, UI) is testable in isolation
 * - Transport logic can be reused without coupling to UI state
 * - Easier to maintain and reason about
 */
export const useThread = (threadId: string) => {
  // HTTP data fetching and state management
  const {
    thread,
    messages,
    isLoading,
    error,
    chatIsLoading,
    chatError,
    chatIsSending,
    chatSendError,
    hasOlderMessages,
    isLoadingOlderMessages,
    loadThread,
    loadMessages,
    catchUpMessages,
    loadOlderMessages,
    sendMessage,
    setMessages,
  } = useThreadData(threadId);

  // WebSocket transport and real-time events
  const {
    agentActivity,
    agentResponseStream,
    onMessageCreated,
    onSubscribed,
  } = useThreadSocket(threadId);

  // Boot: Load initial data
  useEffect(() => {
    loadThread();
    loadMessages();
  }, [loadThread, loadMessages]);

  // Nothing posted before the socket joined the thread room was sent to it:
  // not between the first fetch and the join on mount, and not while
  // disconnected on a reconnect. Fetch what was missed once events flow.
  useEffect(() => {
    onSubscribed(() => {
      void catchUpMessages();
    });
  }, [onSubscribed, catchUpMessages]);

  // Handle incoming messages from WebSocket
  useEffect(() => {
    onMessageCreated((incomingMessage: Message) => {
      setMessages(prev => {
        return sortMessages([
          ...prev.filter(existingMessage => existingMessage.id !== incomingMessage.id),
          incomingMessage,
        ]);
      });
    });
  }, [onMessageCreated, setMessages]);

  return {
    // UI feedback
    isLoading,
    error,
    chatIsLoading,
    chatError,
    chatIsSending,
    chatSendError,
    hasOlderMessages,
    isLoadingOlderMessages,

    // Data
    messages,
    agentActivity,
    agentResponseStream,
    sendMessage,
    loadOlderMessages,
  };
};
