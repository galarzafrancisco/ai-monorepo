import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ContextService } from './api';
import { ContextBlock, ContextBlockSummary } from './types';
import { getUIWebSocketUrl } from '../../config/api';

// WebSocket connection configuration
const SOCKET_URL = getUIWebSocketUrl('/context');

// Wire event names matching backend ContextWireEvents
const ContextWireEvents = {
  CONTEXT_BLOCK_CREATED: 'context.block.created',
  CONTEXT_BLOCK_UPDATED: 'context.block.updated',
  CONTEXT_BLOCK_DELETED: 'context.block.deleted',
} as const;

// Event payload structure from backend
type ContextBlockEvent = {
  payload: ContextBlockSummary;
  actor: {
    id: string;
  };
};

type ContextBlockDeletedEvent = {
  payload: {
    blockId: string;
  };
  actor: {
    id: string;
  };
};

export function useContextBlocks() {
  const [blocks, setBlocks] = useState<ContextBlockSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Sort blocks by updatedAt (newest first)
  const sortBlocks = (blocks: ContextBlockSummary[]): ContextBlockSummary[] => {
    return [...blocks].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  };

  // Load blocks from API
  const loadBlocks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await ContextService.contextControllerListBlocks();
      setBlocks(sortBlocks(data.items));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch context blocks');
      console.error('Error fetching context blocks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup WebSocket connection
  const setupWebSocket = () => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to context WebSocket');
      newSocket.emit('context.subscribe', {}, (ack: any) => {
        if (ack.ok) {
          console.log('Subscribed to context room:', ack.room);
          setIsConnected(true);
        } else {
          console.error('Failed to subscribe to context room');
          setIsConnected(false);
        }
      });
      // Reload blocks on reconnect
      loadBlocks();
    });

    newSocket.on('disconnect', () => {
      console.log('Context WebSocket disconnected');
      setIsConnected(false);
    });

    // Handle block created event
    newSocket.on(ContextWireEvents.CONTEXT_BLOCK_CREATED, (event: ContextBlockEvent) => {
      console.log('context.block.created', event);
      setBlocks((prev) => {
        // Avoid duplicates - check if block already exists
        if (prev.some(b => b.id === event.payload.id)) {
          return prev;
        }
        return sortBlocks([event.payload, ...prev]);
      });
    });

    // Handle block updated event
    newSocket.on(ContextWireEvents.CONTEXT_BLOCK_UPDATED, (event: ContextBlockEvent) => {
      console.log('context.block.updated', event);
      setBlocks((prev) =>
        sortBlocks(prev.map((b) => (b.id === event.payload.id ? event.payload : b)))
      );
    });

    // Handle block deleted event
    newSocket.on(ContextWireEvents.CONTEXT_BLOCK_DELETED, (event: ContextBlockDeletedEvent) => {
      console.log('context.block.deleted', event);
      setBlocks((prev) => prev.filter((b) => b.id !== event.payload.blockId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  };

  // Boot
  useEffect(() => {
    loadBlocks();
    const cleanup = setupWebSocket();
    return cleanup;
  }, []);

  return { blocks, isLoading, error, isConnected, reload: loadBlocks };
}

export function useContextBlock(id: string) {
  const [block, setBlock] = useState<ContextBlock | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchBlock = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await ContextService.contextControllerGetBlock(id);
        if (isMounted) {
          setBlock(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch context block');
          console.error('Error fetching context block:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (id) {
      fetchBlock();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  return { block, isLoading, error };
}
