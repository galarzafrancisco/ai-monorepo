import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { WorkerSeenWireEvent } from '@taico/events';
import { WorkerWireEvents } from '@taico/events';
import { apiConfig } from '../../config/api';

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

  useEffect(() => {
    let socket: Socket | null = null;
    let isMounted = true;

    // Fetch initial workers list
    const fetchWorkers = async () => {
      try {
        const response = await fetch(`${apiConfig.apiUrl}/workers`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch workers: ${response.statusText}`);
        }

        const data = await response.json();

        if (isMounted) {
          setWorkers(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching workers:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load workers');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Connect to WebSocket for realtime updates
    const connectWebSocket = () => {
      const wsUrl = apiConfig.apiUrl.replace(/^http/, 'ws');

      socket = io(`${wsUrl}/workers`, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        console.log('Connected to workers WebSocket');
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from workers WebSocket');
      });

      socket.on('connect_error', (err) => {
        console.error('Workers WebSocket connection error:', err);
      });

      // Listen for worker.seen events
      socket.on(WorkerWireEvents.WORKER_SEEN, (event: WorkerSeenWireEvent) => {
        if (!isMounted) return;

        setWorkers((prevWorkers) => {
          const existingIndex = prevWorkers.findIndex(
            (w) => w.id === event.worker.id
          );

          if (existingIndex >= 0) {
            // Update existing worker
            const updated = [...prevWorkers];
            updated[existingIndex] = event.worker;
            return updated;
          } else {
            // Add new worker
            return [...prevWorkers, event.worker];
          }
        });
      });
    };

    fetchWorkers();
    connectWebSocket();

    return () => {
      isMounted = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  return { workers, isLoading, error };
}
