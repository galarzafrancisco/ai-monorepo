import { useEffect } from 'react';
import type { Message } from './types';
import { useThreadData } from './useThreadData';
import { useThreadSocket } from './useThreadSocket';

const sortMessages = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateA - dateB; // Ascending order (oldest first)
  });
};

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
    loadThread,
    loadMessages,
    sendMessage,
    setMessages,
  } = useThreadData(threadId);

  // WebSocket transport and real-time events
  const {
    agentActivity,
    onMessageCreated,
  } = useThreadSocket(threadId);

  // Boot: Load initial data
  useEffect(() => {
    loadThread();
    loadMessages();
  }, [loadThread, loadMessages]);

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

    // Data
    messages,
    agentActivity,
    sendMessage,
  };
};
