import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ExecutionsService } from './api';
import type { Execution } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import {
  ExecutionWireEvents,
  ExecutionCreatedWireEvent,
  ExecutionUpdatedWireEvent,
  ExecutionDeletedWireEvent,
} from '@taico/events';

// Use centralized API configuration
const SOCKET_URL = getUIWebSocketUrl('/executions');
const EXECUTIONS_PAGE_SIZE = 100;

export const useExecutions = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [executions, setExecutions] = useState<Execution[]>([]);

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Boot
  useEffect(() => {
    loadExecutions();
    const cleanup = setupWebsocket();
    return cleanup;
  }, []);

  // Sort executions by updatedAt (newest first)
  const sortExecutions = (executions: Execution[]): Execution[] => {
    return [...executions].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  };

  // Load executions
  const loadExecutions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ExecutionsService.ExecutionsController_listExecutions({
        page: 1,
        limit: EXECUTIONS_PAGE_SIZE,
      });
      setExecutions(sortExecutions(response.items as Execution[]));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load executions'
      );
    } finally {
      setHasLoadedOnce(true);
      setIsLoading(false);
    }
  };

  // Setup websocket
  const setupWebsocket = () => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to executions websocket');
      newSocket.emit('executions.subscribe', {}, (ack: any) => {
        if (ack.ok) {
          console.log(ack);
          console.log('Subscribed to room:', ack.room);
          setIsConnected(true);
        } else {
          console.error('Failed to subscribe to executions room');
          setIsConnected(false);
        }
      });
      loadExecutions();
    });

    newSocket.on('disconnect', () => {
      console.log('Executions WebSocket disconnected');
      setIsConnected(false);
    });

    // Handle execution created event
    newSocket.on(
      ExecutionWireEvents.EXECUTION_CREATED,
      (event: ExecutionCreatedWireEvent) => {
        console.log('execution.created', event);
        setExecutions((prev) => {
          // Avoid duplicates - check if execution already exists
          if (prev.some((e) => e.id === event.payload.id)) {
            return prev;
          }
          return sortExecutions([event.payload as Execution, ...prev]);
        });
      }
    );

    // Handle execution updated event
    newSocket.on(
      ExecutionWireEvents.EXECUTION_UPDATED,
      (event: ExecutionUpdatedWireEvent) => {
        console.log('execution.updated', event);
        setExecutions((prev) =>
          sortExecutions(
            prev.map((e) =>
              e.id === event.payload.id ? (event.payload as Execution) : e
            )
          )
        );
      }
    );

    // Handle execution deleted event
    newSocket.on(
      ExecutionWireEvents.EXECUTION_DELETED,
      (event: ExecutionDeletedWireEvent) => {
        console.log('execution.deleted', event);
        setExecutions((prev) =>
          prev.filter((e) => e.id !== event.payload.executionId)
        );
      }
    );

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  };

  return {
    // UI feedback
    isLoading,
    hasLoadedOnce,
    error,

    // Data
    executions,
    loadExecutions,

    // Transport
    isConnected,
  };
};
