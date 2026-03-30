import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ThreadsService } from './api';
import type { ThreadListItem, Thread } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import { ThreadTitleUpdatedWireEvent, ThreadWireEvents } from '@taico/events';

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

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Boot
  useEffect(() => {
    loadThreads();
    const cleanup = setupWebsocket();
    return cleanup;
  }, []);

  // Load threads
  const loadThreads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ThreadsService.listThreads();
      setThreads(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    } finally {
      setIsLoading(false);
    }
  };

  // Get single thread with full details
  const getThread = useCallback(async (id: string): Promise<Thread> => {
    return await ThreadsService.getThread(id);
  }, []);

  // Create a new thread
  const createThread = useCallback(async (title?: string): Promise<Thread> => {
    const thread = await ThreadsService.createThread({ title });
    // Add to local state optimistically
    setThreads((prev) => [thread, ...prev]);
    return thread;
  }, []);

  const deleteThread = useCallback(async (id: string) => {
    await ThreadsService.deleteThread(id);
    setThreads((prev) => prev.filter((thread) => thread.id !== id));
  }, []);

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
  }, []);

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
  };
};
