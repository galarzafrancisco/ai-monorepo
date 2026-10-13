import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ThreadsService } from './api';
import type { ThreadListItem, Thread } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import {
  ThreadActivityWireEvent,
  ThreadReadWireEvent,
  ThreadTitleUpdatedWireEvent,
  ThreadWireEvents,
} from '@taico/events';
import { useAuth } from '../../auth';

type ThreadsSubscribeAck = {
  ok: boolean;
  room?: string;
  error?: string;
};


// Use centralized API configuration
const SOCKET_URL = getUIWebSocketUrl('/threads');

export const useThreads = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const threadIdsRef = useRef<Set<string>>(new Set());
  threadIdsRef.current = new Set(threads.map((thread) => thread.id));

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Read by socket handlers, which outlive a render.
  const { user } = useAuth();
  const actorIdRef = useRef<string | undefined>(user?.actorId);
  actorIdRef.current = user?.actorId;
  /** The thread the user is looking at right now, if any. */
  const viewingThreadIdRef = useRef<string | null>(null);

  // Load threads
  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ThreadsService.ThreadsController_listThreads({});
      setThreads(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Same as loadThreads, without the loading state: used to catch up in the background.
  const refreshThreads = useCallback(async () => {
    try {
      const response = await ThreadsService.ThreadsController_listThreads({});
      setThreads(response.items || []);
    } catch (err) {
      console.error('Failed to refresh threads', err);
    }
  }, []);

  const setUnreadCount = useCallback((threadId: string, unreadCount: number) => {
    setThreads((prev) =>
      prev.some((thread) => thread.id === threadId && thread.unreadCount !== unreadCount)
        ? prev.map((thread) =>
            thread.id === threadId ? { ...thread, unreadCount } : thread,
          )
        : prev,
    );
  }, []);

  const setViewingThreadId = useCallback((threadId: string | null) => {
    viewingThreadIdRef.current = threadId;
  }, []);

  // Clears the indicator here straight away; the server tells the user's other tabs and devices.
  const markThreadRead = useCallback(async (threadId: string) => {
    setUnreadCount(threadId, 0);
    try {
      await ThreadsService.ThreadsController_markThreadRead({ id: threadId });
    } catch (err) {
      console.error('Failed to mark thread as read', err);
    }
  }, [setUnreadCount]);

  // Get single thread with full details
  const getThread = useCallback(async (id: string): Promise<Thread> => {
    return await ThreadsService.ThreadsController_getThread({ id });
  }, []);

  // Create a new thread
  const createThread = useCallback(async (title?: string): Promise<Thread> => {
    const thread = await ThreadsService.ThreadsController_createThread({ body: { title } });
    // Add to local state optimistically
    setThreads((prev) => [{ ...thread, unreadCount: 0 }, ...prev]);
    return thread;
  }, []);

  const deleteThread = useCallback(async (id: string) => {
    await ThreadsService.ThreadsController_deleteThread({ id });
    setThreads((prev) => prev.filter((thread) => thread.id !== id));
  }, []);

  // Setup websocket
  const setupWebsocket = useCallback(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    let hasConnectedBefore = false;

    newSocket.on('connect', () => {
      console.log('Connected to websocket');
      // Events sent while disconnected are lost, so unread counts may be stale.
      if (hasConnectedBefore) {
        void refreshThreads();
      }
      hasConnectedBefore = true;
      newSocket.emit('threads.subscribe', {}, (ack: ThreadsSubscribeAck) => {
        if (ack.ok) {
          console.log(ack);
          console.log('Subscribed to room:', ack.room);
          setIsConnected(true);
        } else {
          console.error('Failed to subscribe to room');
          setIsConnected(false);
        }
      });
    });

    newSocket.on(ThreadWireEvents.THREAD_TITLE_UPDATED, (event: ThreadTitleUpdatedWireEvent) => {
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === event.payload.threadId
            ? { ...thread, title: event.payload.title }
            : thread,
        ),
      );
    });

    newSocket.on(ThreadWireEvents.THREAD_ACTIVITY, (event: ThreadActivityWireEvent) => {
      const { threadId, createdByActorId } = event.payload;
      if (createdByActorId === actorIdRef.current) {
        return;
      }
      // The user is watching this message arrive; the open chat marks it read.
      if (viewingThreadIdRef.current === threadId) {
        return;
      }

      if (!threadIdsRef.current.has(threadId)) {
        // A thread this list has not loaded, e.g. created in another tab.
        void refreshThreads();
        return;
      }

      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadId
            ? { ...thread, unreadCount: thread.unreadCount + 1 }
            : thread,
        ),
      );
    });

    newSocket.on(ThreadWireEvents.THREAD_READ, (event: ThreadReadWireEvent) => {
      setUnreadCount(event.payload.threadId, 0);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('threads.unsubscribe', {});
      newSocket.close();
      setSocket(null);
      setIsConnected(false);
    };
  }, [refreshThreads, setUnreadCount]);

  // Boot
  useEffect(() => {
    void loadThreads();
    const cleanup = setupWebsocket();
    return cleanup;
  }, [loadThreads, setupWebsocket]);

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    threads,
    loadThreads,
    getThread,
    createThread,
    deleteThread,
    markThreadRead,
    setViewingThreadId,
  };
};
