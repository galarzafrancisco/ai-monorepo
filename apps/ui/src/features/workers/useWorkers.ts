import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { WorkerSeenWireEvent } from '@taico/events';
import { WorkerWireEvents } from '@taico/events';
import { getUIWebSocketUrl } from '../../config/api';
import { WorkersService } from './api';

const SOCKET_URL = getUIWebSocketUrl('/workers');

type WorkersSubscribeAck = {
  ok: boolean;
  room?: string;
  error?: string;
};

export interface Worker {
  id: string;
  oauthClientId: string;
  lastSeenAt: string;
  harnesses: string[];
  createdAt: string;
  updatedAt: string;
}

export function useWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const sortWorkers = (items: Worker[]): Worker[] => {
    return [...items].sort((a, b) => {
      const aDate = new Date(a.lastSeenAt).getTime();
      const bDate = new Date(b.lastSeenAt).getTime();
      return bDate - aDate;
    });
  };

  const loadWorkers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await WorkersService.WorkersController_listWorkers();
      setWorkers(sortWorkers(response));
    } catch (err) {
      console.error('Error fetching workers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    loadWorkers();

    socket.on('connect', () => {
      socket.emit('workers.subscribe', {}, (ack: WorkersSubscribeAck) => {
        if (ack.ok) {
          setIsConnected(true);
          return;
        }
        setIsConnected(false);
      });
      loadWorkers();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Workers WebSocket connection error:', err);
    });

    socket.on(WorkerWireEvents.WORKER_SEEN, (event: WorkerSeenWireEvent) => {
      setWorkers((prevWorkers) => {
        const existingIndex = prevWorkers.findIndex(
          (worker) => worker.id === event.worker.id,
        );

        if (existingIndex >= 0) {
          const updated = [...prevWorkers];
          updated[existingIndex] = event.worker;
          return sortWorkers(updated);
        }

        return sortWorkers([...prevWorkers, event.worker]);
      });
    });

    return () => {
      socket.emit('workers.unsubscribe', {});
      socket.disconnect();
    };
  }, []);

  return { workers, isLoading, error, isConnected };
}
