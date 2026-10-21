import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ThreadsService } from './api';
import type { ThreadListItem, Thread } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import {
  ThreadActivityWireEvent,
  ThreadPinnedWireEvent,
  ThreadReadWireEvent,
  ThreadTitleUpdatedWireEvent,
  ThreadWireEvents,
} from '@taico/events';
import { useAuth } from '../../auth';
import { createSnapshotSync, SnapshotSync } from './snapshotSync';
import { applyThreadActivity, applyThreadPinned, compareThreads } from './threadListOrder';

type ThreadsSubscribeAck = {
  ok: boolean;
  room?: string;
  error?: string;
};


// Use centralized API configuration
const SOCKET_URL = getUIWebSocketUrl('/threads');

/** How many threads each request asks for. The list grows by this much at a time. */
export const THREADS_PAGE_SIZE = 100;

type ThreadsSnapshot = {
  items: ThreadListItem[];
  /** How many threads exist on the server, loaded or not. */
  total: number;
};

/**
 * Fetches the first `pageCount` pages: pinned threads, then latest message first.
 *
 * Every refresh fetches everything the list is showing, not just the last
 * page, so the list stays one snapshot: see snapshotSync.ts.
 */
const fetchThreadPages = async (pageCount: number): Promise<ThreadsSnapshot> => {
  const items: ThreadListItem[] = [];
  const seen = new Set<string>();
  let total = 0;

  for (let page = 1; page <= pageCount; page += 1) {
    const response = await ThreadsService.ThreadsController_listThreads({
      page,
      limit: THREADS_PAGE_SIZE,
    });
    const pageItems = response.items || [];
    total = response.total ?? 0;

    // A thread that moved up between two requests shows up on both pages.
    for (const item of pageItems) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }

    if (pageItems.length < THREADS_PAGE_SIZE) break;
  }

  return { items, total: Math.max(total, items.length) };
};

export const useThreads = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Data store
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const threadIdsRef = useRef<Set<string>>(new Set());
  threadIdsRef.current = new Set(threads.map((thread) => thread.id));
  /** How many threads exist on the server, loaded or not. */
  const [totalThreads, setTotalThreads] = useState(0);
  /** How many pages the list is showing. Grows as the user scrolls down. */
  const pageCountRef = useRef(1);
  const isLoadingMoreRef = useRef(false);
  const hasMoreThreads = threads.length < totalThreads;

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Read by socket handlers, which outlive a render.
  const { user } = useAuth();
  const actorIdRef = useRef<string | undefined>(user?.actorId);
  actorIdRef.current = user?.actorId;
  /** The thread the user is looking at right now, if any. */
  const viewingThreadIdRef = useRef<string | null>(null);

  // Every fetch of the list goes through here, so a slow response can never
  // undo a change that arrived while it was on its way. See snapshotSync.ts.
  const syncRef = useRef<SnapshotSync | null>(null);
  if (!syncRef.current) {
    syncRef.current = createSnapshotSync(
      () => fetchThreadPages(pageCountRef.current),
      (snapshot: ThreadsSnapshot) => {
        setThreads(snapshot.items);
        setTotalThreads(snapshot.total);
      },
    );
  }
  const sync = syncRef.current;

  // Load threads
  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await sync.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    } finally {
      setIsLoading(false);
    }
  }, [sync]);

  // Same as loadThreads, without the loading state: used to catch up in the background.
  const refreshThreads = useCallback(async () => {
    try {
      await sync.refresh();
    } catch (err) {
      console.error('Failed to refresh threads', err);
    }
  }, [sync]);

  // Shows one more page of older threads.
  const loadMoreThreads = useCallback(async () => {
    if (isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    pageCountRef.current += 1;
    try {
      await sync.refresh();
    } catch (err) {
      pageCountRef.current = Math.max(1, pageCountRef.current - 1);
      setLoadMoreError(err instanceof Error ? err.message : 'Failed to load more threads');
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [sync]);

  const setUnreadCount = useCallback((threadId: string, unreadCount: number) => {
    sync.noteChange();
    setThreads((prev) =>
      prev.some((thread) => thread.id === threadId && thread.unreadCount !== unreadCount)
        ? prev.map((thread) =>
            thread.id === threadId ? { ...thread, unreadCount } : thread,
          )
        : prev,
    );
  }, [sync]);

  const setViewingThreadId = useCallback((threadId: string | null) => {
    viewingThreadIdRef.current = threadId;
  }, []);

  // Clears the indicator here straight away; the server tells the user's other tabs and devices.
  const markThreadRead = useCallback(async (threadId: string) => {
    setUnreadCount(threadId, 0);
    try {
      await ThreadsService.ThreadsController_markThreadRead({ id: threadId });
      // A list fetched before the server recorded this would bring the count back.
      sync.noteChange();
    } catch (err) {
      console.error('Failed to mark thread as read', err);
    }
  }, [setUnreadCount, sync]);

  // Moves the thread here straight away; the server tells the user's other tabs and devices.
  const setThreadPinned = useCallback(async (threadId: string, pinned: boolean) => {
    sync.noteChange();
    setThreads((prev) => applyThreadPinned(prev, threadId, pinned));
    try {
      if (pinned) {
        await ThreadsService.ThreadsController_pinThread({ id: threadId });
      } else {
        await ThreadsService.ThreadsController_unpinThread({ id: threadId });
      }
      // A list fetched before the server recorded this would undo the move.
      sync.noteChange();
    } catch (err) {
      console.error(`Failed to ${pinned ? 'pin' : 'unpin'} thread`, err);
      sync.noteChange();
      setThreads((prev) => applyThreadPinned(prev, threadId, !pinned));
    }
  }, [sync]);

  // Get single thread with full details
  const getThread = useCallback(async (id: string): Promise<Thread> => {
    return await ThreadsService.ThreadsController_getThread({ id });
  }, []);

  // Create a new thread
  const createThread = useCallback(async (title?: string): Promise<Thread> => {
    const thread = await ThreadsService.ThreadsController_createThread({ body: { title } });
    // Add to local state optimistically. A thread with no messages yet is
    // ordered by when it was created, so the new one goes first after the
    // pinned threads.
    sync.noteChange();
    setThreads((prev) => [
      { ...thread, lastActivityAt: thread.createdAt, unreadCount: 0, pinned: false },
      ...prev,
    ].sort(compareThreads));
    setTotalThreads((prev) => prev + 1);
    return thread;
  }, [sync]);

  const deleteThread = useCallback(async (id: string) => {
    await ThreadsService.ThreadsController_deleteThread({ id });
    sync.noteChange();
    // The thread is gone from the server whether or not this list had loaded
    // it: one opened by URL can be older than every loaded page.
    setTotalThreads((prev) => Math.max(0, prev - 1));
    setThreads((prev) => prev.filter((thread) => thread.id !== id));
  }, [sync]);

  // Setup websocket
  const setupWebsocket = useCallback(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to websocket');
      newSocket.emit('threads.subscribe', {}, (ack: ThreadsSubscribeAck) => {
        if (ack.ok) {
          console.log(ack);
          console.log('Subscribed to room:', ack.room);
          setIsConnected(true);
          // Nothing posted before this point was sent to this socket: not
          // between the first fetch and now on page load, and not while
          // disconnected on a reconnect. Fetch again now that events flow.
          void refreshThreads();
        } else {
          console.error('Failed to subscribe to room');
          setIsConnected(false);
        }
      });
    });

    newSocket.on(ThreadWireEvents.THREAD_TITLE_UPDATED, (event: ThreadTitleUpdatedWireEvent) => {
      sync.noteChange();
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === event.payload.threadId
            ? { ...thread, title: event.payload.title }
            : thread,
        ),
      );
    });

    newSocket.on(ThreadWireEvents.THREAD_ACTIVITY, (event: ThreadActivityWireEvent) => {
      if (!threadIdsRef.current.has(event.payload.threadId)) {
        // A thread this list has not loaded: created in another tab, or older
        // than every loaded page. The server now lists it first.
        void refreshThreads();
        return;
      }

      // Every message moves its thread up, the user's own included. Whether it
      // also counts as unread is decided separately: see threadListOrder.ts.
      sync.noteChange();
      setThreads(
        (prev) =>
          applyThreadActivity(prev, event.payload, {
            actorId: actorIdRef.current,
            viewingThreadId: viewingThreadIdRef.current,
          }) ?? prev,
      );
    });

    newSocket.on(ThreadWireEvents.THREAD_READ, (event: ThreadReadWireEvent) => {
      setUnreadCount(event.payload.threadId, 0);
    });

    newSocket.on(ThreadWireEvents.THREAD_PINNED, (event: ThreadPinnedWireEvent) => {
      if (!threadIdsRef.current.has(event.payload.threadId)) {
        // Pinned from another tab while older than every loaded page: the
        // server now lists it on the first page.
        if (event.payload.pinned) void refreshThreads();
        return;
      }
      sync.noteChange();
      setThreads((prev) =>
        applyThreadPinned(prev, event.payload.threadId, event.payload.pinned),
      );
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
  }, [refreshThreads, setUnreadCount, sync]);

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
    isLoadingMore,
    loadMoreError,

    // Data
    threads,
    totalThreads,
    hasMoreThreads,
    loadThreads,
    loadMoreThreads,
    refreshThreads,
    getThread,
    createThread,
    deleteThread,
    markThreadRead,
    setThreadPinned,
    setViewingThreadId,
  };
};
