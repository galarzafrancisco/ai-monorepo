import { useEffect } from 'react';
import type { Message } from './types';
import { sortMessages, useThreadData } from './useThreadData';
import { useThreadSocket } from './useThreadSocket';

/** How long the first load of messages waits for the socket to join the thread room. */
const FIRST_LOAD_MAX_WAIT_MS = 500;

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
    activity,
    agentResponseStream,
    onMessageCreated,
    onSubscribed,
  } = useThreadSocket(threadId);

  // Boot: Load initial data
  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Nothing posted before the socket joined the thread room was sent to it:
  // not before the join on mount, and not while disconnected on a reconnect.
  // So messages are fetched once events flow: the first join does the first
  // load, and each later join fetches what was missed.
  useEffect(() => {
    let firstLoadStarted = false;
    const startFirstLoad = () => {
      firstLoadStarted = true;
      void loadMessages();
    };

    onSubscribed(() => {
      if (firstLoadStarted) {
        void catchUpMessages();
      } else {
        startFirstLoad();
      }
    });

    // The chat must not wait on a socket that is slow or cannot connect. The
    // join that comes after this load catches up, as a reconnect does.
    const fallbackTimer = setTimeout(() => {
      if (!firstLoadStarted) startFirstLoad();
    }, FIRST_LOAD_MAX_WAIT_MS);

    return () => {
      clearTimeout(fallbackTimer);
      onSubscribed(null);
    };
  }, [onSubscribed, loadMessages, catchUpMessages]);

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
    activity,
    agentResponseStream,
    sendMessage,
    loadOlderMessages,
  };
};
