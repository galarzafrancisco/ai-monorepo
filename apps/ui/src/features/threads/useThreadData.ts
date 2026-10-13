import { useState, useCallback, useRef } from 'react';
import { ThreadsService } from './api';
import type { Thread, Message } from './types';

const sortMessages = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateA - dateB; // Ascending order (oldest first)
  });
};

// The API returns messages newest first, a page at a time.
const MESSAGES_PAGE_SIZE = 50;

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
  /** True while the thread has messages older than the ones loaded. */
  hasOlderMessages: boolean;
  isLoadingOlderMessages: boolean;

  // Actions
  loadThread: () => Promise<void>;
  /** Loads the latest messages, replacing whatever was loaded. */
  loadMessages: () => Promise<void>;
  /** Loads the next page of older messages and adds it to the loaded ones. */
  loadOlderMessages: () => Promise<void>;
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
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const nextOlderPageRef = useRef(2);
  const isLoadingOlderRef = useRef(false);

  // Data store
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Load thread
  const loadThread = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ThreadsService.ThreadsController_getThread({ id: threadId });
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
      const response = await ThreadsService.ThreadsController_listMessages({
        id: threadId,
        page: 1,
        limit: MESSAGES_PAGE_SIZE,
      });
      setMessages(sortMessages(response.items));
      setHasOlderMessages(response.total > MESSAGES_PAGE_SIZE);
      nextOlderPageRef.current = 2;
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setChatIsLoading(false);
    }
  }, [threadId]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlderRef.current) return;
    isLoadingOlderRef.current = true;
    setIsLoadingOlderMessages(true);
    setChatError(null);
    try {
      const page = nextOlderPageRef.current;
      const response = await ThreadsService.ThreadsController_listMessages({
        id: threadId,
        page,
        limit: MESSAGES_PAGE_SIZE,
      });
      // Messages posted since the first page shift the pages, so this one can
      // repeat messages already loaded. It can never skip any.
      setMessages((prev) => {
        const loadedIds = new Set(prev.map((message) => message.id));
        return sortMessages([
          ...response.items.filter((message) => !loadedIds.has(message.id)),
          ...prev,
        ]);
      });
      setHasOlderMessages(response.total > page * MESSAGES_PAGE_SIZE);
      nextOlderPageRef.current = page + 1;
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to load older messages');
    } finally {
      isLoadingOlderRef.current = false;
      setIsLoadingOlderMessages(false);
    }
  }, [threadId]);

  // Send a message
  const sendMessage = useCallback(async (content: string): Promise<Message | null> => {
    setChatIsSending(true);
    setChatSendError(null);
    let message: Message | null = null;
    try {
      message = await ThreadsService.ThreadsController_createMessage({ id: threadId, body: { content } });
    } catch (err) {
      setChatSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setChatIsSending(false);
    }
    return message;
  }, [threadId]);

  const deleteThread = useCallback(async (id: string) => {
    await ThreadsService.ThreadsController_deleteThread({ id });
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
    hasOlderMessages,
    isLoadingOlderMessages,

    // Actions
    loadThread,
    loadMessages,
    loadOlderMessages,
    sendMessage,
    deleteThread,
    setMessages,
    setThread,
  };
};
