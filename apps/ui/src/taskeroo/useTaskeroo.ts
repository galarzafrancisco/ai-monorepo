import { io, Socket } from 'socket.io-client';
import { TaskerooService } from './api'
import { Task } from './types';
import { useEffect, useState } from 'react';

const SOCKET_URL = 'http://localhost:3000/taskeroo'; // TODO: move to config

export const useTaskeroo = () => {

  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [tasks, setTasks] = useState<Task[]>([]);

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Boot
  useEffect(() => {
    loadTasks();
    setupWebsocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Load tasks
  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await TaskerooService.taskerooControllerListTasks();
      setTasks(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks'); // Question: should we have an error map instead of passing back raw messages?
    } finally {
      setIsLoading(false);
    }
  };

  // Setup websocket
  const setupWebsocket = () => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to websocket');
      setIsConnected(true);
      loadTasks();
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('task.created', (task: Task) => {
      setTasks((prev) => {
        // Avoid duplicates - check if task already exists
        if (prev.some(t => t.id === task.id)) {
          return prev;
        }
        return [task, ...prev];
      });
    });

    newSocket.on('task.updated', (task: Task) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t))
      );
    });

    newSocket.on('task.deleted', ({ taskId }: { taskId: string }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    });

    newSocket.on('task.assigned', (task: Task) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t))
      );
    });

    newSocket.on('task.commented', () => {
      // Refresh task to get new comment
      // In a real app, you might update the specific task
    });

    newSocket.on('task.status_changed', (task: Task) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t))
      );
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  };

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    tasks,

    // Transport
    isConnected,
  };
}