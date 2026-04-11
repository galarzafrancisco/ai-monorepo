import { useState, useCallback } from 'react';
import { ThreadsService } from './api';
import type { Thread, Message } from './types';

const sortMessages = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateA - dateB; // Ascending order (oldest first)
  });
};

export interface UseThreadDataResult {
  // Data
  thread: Thread | null;
  messages: Message[];

  // Loading states
  isLoading: boolean;
  error: string | null;
  chatIsLoading: boolean;
  chatError: string | null;
  chatIsSending: boolean;
  chatSendError: string | null;

  // Actions
  loadThread: () => Promise<void>;
  loadMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<Message | null>;
  deleteThread: (id: string) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setThread: React.Dispatch<React.SetStateAction<Thread | null>>;
}

/**
 * Manages HTTP data fetching and state for a thread
 * Handles:
 * - Loading thread metadata
 * - Loading messages
 * - Sending messages
 * - Deleting threads
 * - Loading and error states
 */
export const useThreadData = (threadId: string): UseThreadDataResult => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatIsLoading, setChatIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatIsSending, setChatIsSending] = useState(false);
  const [chatSendError, setChatSendError] = useState<string | null>(null);

  // Data store
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Load thread
  const loadThread = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ThreadsService.getThread(threadId);
      setThread(response || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  // Load messages
  const loadMessages = useCallback(async () => {
    setChatIsLoading(true);
    setChatError(null);
    try {
      const response = await ThreadsService.listMessages(threadId);
      setMessages(sortMessages(response.items));
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setChatIsLoading(false);
    }
  }, [threadId]);

  // Send a message
  const sendMessage = useCallback(async (content: string): Promise<Message | null> => {
    setChatIsSending(true);
    setChatSendError(null);
    let message: Message | null = null;
    try {
      message = await ThreadsService.createMessage(threadId, content);
    } catch (err) {
      setChatSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setChatIsSending(false);
    }
    return message;
  }, [threadId]);

  const deleteThread = useCallback(async (id: string) => {
    await ThreadsService.deleteThread(id);
    setThread(null);
  }, []);

  return {
    // Data
    thread,
    messages,

    // Loading states
    isLoading,
    error,
    chatIsLoading,
    chatError,
    chatIsSending,
    chatSendError,

    // Actions
    loadThread,
    loadMessages,
    sendMessage,
    deleteThread,
    setMessages,
    setThread,
  };
};
