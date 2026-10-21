import { useState, useCallback, useRef } from 'react';
import { ThreadsService } from './api';
import type { Thread, Message } from './types';
import { browserTimeZone } from '../../shared/helpers/browserTimeZone';

const compareMessages = (a: Message, b: Message): number => {
  const dateA = new Date(a.createdAt).getTime();
  const dateB = new Date(b.createdAt).getTime();
  if (dateA !== dateB) return dateA - dateB;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** Oldest first, by the same fields the API orders by: creation time, then id. */
export const sortMessages = (messages: Message[]): Message[] => {
  return [...messages].sort(compareMessages);
};

/**
 * True when the latest page cannot be joined to the loaded messages: none of
 * its messages is loaded, so an unknown number of messages sit between the two.
 */
export const latestPageLeavesGap = (loaded: Message[], latestPage: Message[]): boolean => {
  if (loaded.length === 0 || latestPage.length === 0) return false;
  const loadedIds = new Set(loaded.map((message) => message.id));
  return !latestPage.some((message) => loadedIds.has(message.id));
};

/**
 * Adds a freshly fetched latest page to the loaded messages.
 *
 * Returns `loaded` itself when the page brings nothing new, so callers that
 * react to a new list (scrolling to the bottom) are left alone.
 *
 * When the page leaves a gap, the loaded messages older than the page are
 * dropped: the list restarts from the latest page, like a first load.
 */
export const mergeLatestPage = (loaded: Message[], latestPage: Message[]): Message[] => {
  if (latestPage.length === 0) return loaded;
  const loadedIds = new Set(loaded.map((message) => message.id));
  const newMessages = latestPage.filter((message) => !loadedIds.has(message.id));
  if (newMessages.length === 0) return loaded;

  if (latestPageLeavesGap(loaded, latestPage)) {
    // Anything loaded that is not older than the page came over the socket
    // after the fetch, and follows the page without a gap.
    const newestOfPage = Math.max(
      ...latestPage.map((message) => new Date(message.createdAt).getTime()),
    );
    return sortMessages([
      ...latestPage,
      ...loaded.filter((message) => new Date(message.createdAt).getTime() >= newestOfPage),
    ]);
  }
  return sortMessages([...loaded, ...newMessages]);
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
  /**
   * Loads the latest messages, replacing whatever was loaded before the call.
   * Messages that arrive while it runs are kept.
   */
  loadMessages: () => Promise<void>;
  /**
   * Fetches the latest messages and adds the missing ones to the loaded ones,
   * without the loading state. Older pages already loaded stay loaded, unless
   * more than a page of messages is missing: then the list restarts from the
   * latest page.
   */
  catchUpMessages: () => Promise<void>;
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
  // True from the start: the first load of messages always follows the mount.
  const [chatIsLoading, setChatIsLoading] = useState(true);
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
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;
  /** The `loadMessages` call in flight, if any. */
  const loadMessagesPromiseRef = useRef<Promise<void> | null>(null);

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
  const loadMessages = useCallback(() => {
    const load = async () => {
      setChatIsLoading(true);
      setChatError(null);
      // What this load replaces. Anything added after this point came over the
      // socket while the request was in flight, and the response may predate it.
      const replacedIds = new Set(messagesRef.current.map((message) => message.id));
      try {
        const response = await ThreadsService.ThreadsController_listMessages({
          id: threadId,
          page: 1,
          limit: MESSAGES_PAGE_SIZE,
        });
        const pageIds = new Set(response.items.map((message) => message.id));
        setMessages((prev) =>
          sortMessages([
            ...response.items,
            ...prev.filter((message) => !replacedIds.has(message.id) && !pageIds.has(message.id)),
          ]),
        );
        setHasOlderMessages(response.total > MESSAGES_PAGE_SIZE);
        nextOlderPageRef.current = 2;
      } catch (err) {
        setChatError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        setChatIsLoading(false);
      }
    };
    const promise = load().finally(() => {
      if (loadMessagesPromiseRef.current === promise) {
        loadMessagesPromiseRef.current = null;
      }
    });
    loadMessagesPromiseRef.current = promise;
    return promise;
  }, [threadId]);

  const catchUpMessages = useCallback(async () => {
    // A full load that started earlier would replace what this adds.
    await loadMessagesPromiseRef.current;
    try {
      const response = await ThreadsService.ThreadsController_listMessages({
        id: threadId,
        page: 1,
        limit: MESSAGES_PAGE_SIZE,
      });
      if (threadIdRef.current !== threadId) return;

      const loaded = messagesRef.current;
      if (loaded.length === 0 || latestPageLeavesGap(loaded, response.items)) {
        // Nothing to join the page to: start over from it, as a first load does.
        setHasOlderMessages(response.total > MESSAGES_PAGE_SIZE);
        nextOlderPageRef.current = 2;
      }
      setMessages((prev) => mergeLatestPage(prev, response.items));
      setChatError(null);
    } catch (err) {
      // The loaded messages are still good; the next reconnect tries again.
      console.error('Failed to catch up on thread messages', err);
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
      message = await ThreadsService.ThreadsController_createMessage({ id: threadId, body: { content, timezone: browserTimeZone() } });
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
    catchUpMessages,
    loadOlderMessages,
    sendMessage,
    deleteThread,
    setMessages,
    setThread,
  };
};
