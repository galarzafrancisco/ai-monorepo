import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { getUIWebSocketUrl } from '../config/api';
import { ChatService } from './api';
import type { ChatSessionResponseDto } from 'shared';

const SOCKET_URL = getUIWebSocketUrl('/chat');

export const useChatSessions = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionResponseDto[]>([]);
  const [loading, setLoading] = useState(false);

  // Load sessions from API
  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await ChatService.chatControllerListSessions();
      setSessions(response.items || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Chat WebSocket] Connected');
      setIsConnected(true);
      loadSessions(); // Refresh on connect
    });

    newSocket.on('disconnect', () => {
      console.log('[Chat WebSocket] Disconnected');
      setIsConnected(false);
    });

    // Listen for session events
    newSocket.on('session.created', (session: ChatSessionResponseDto) => {
      console.log('[Chat WebSocket] Session created:', session.id);
      setSessions((prev) => {
        // Avoid duplicates
        if (prev.some((s) => s.id === session.id)) {
          return prev;
        }
        // Add to beginning, sorted by lastMessageAt
        const updated = [session, ...prev];
        return updated.sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime(),
        );
      });
    });

    newSocket.on('session.updated', (session: ChatSessionResponseDto) => {
      console.log('[Chat WebSocket] Session updated:', session.id);
      setSessions((prev) => {
        const updated = prev.map((s) => (s.id === session.id ? session : s));
        // Re-sort by lastMessageAt
        return updated.sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime(),
        );
      });
    });

    newSocket.on(
      'session.deleted',
      ({ sessionId }: { sessionId: string }) => {
        console.log('[Chat WebSocket] Session deleted:', sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      },
    );

    newSocket.on(
      'task.referenced',
      ({
        sessionId,
        taskId,
      }: {
        sessionId: string;
        taskId: string;
      }) => {
        console.log(
          '[Chat WebSocket] Task referenced:',
          sessionId,
          taskId,
        );
        // Optionally refresh the specific session to get updated task references
      },
    );

    newSocket.on(
      'task.subscribed',
      ({
        sessionId,
        taskId,
      }: {
        sessionId: string;
        taskId: string;
      }) => {
        console.log(
          '[Chat WebSocket] Task subscribed:',
          sessionId,
          taskId,
        );
        // Optionally refresh the specific session to get updated subscribed tasks
      },
    );

    newSocket.on(
      'task.unsubscribed',
      ({
        sessionId,
        taskId,
      }: {
        sessionId: string;
        taskId: string;
      }) => {
        console.log(
          '[Chat WebSocket] Task unsubscribed:',
          sessionId,
          taskId,
        );
        // Optionally refresh the specific session to get updated subscribed tasks
      },
    );

    setSocket(newSocket);

    // Load initial data
    loadSessions();

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, isConnected, sessions, loading, loadSessions };
};
