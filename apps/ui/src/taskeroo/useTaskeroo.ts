import { io, Socket } from 'socket.io-client';
import { TaskerooService } from './api'
import { Task, Comment } from './types';
import { useEffect, useState } from 'react';

// Use relative URL in production, absolute URL in development
const SOCKET_URL = import.meta.env.PROD ? '/taskeroo' : 'http://localhost:3000/taskeroo';

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

  // Sort tasks by updatedAt (newest first)
  const sortTasks = (tasks: Task[]): Task[] => {
    return [...tasks].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  };

  // Load tasks
  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await TaskerooService.taskerooControllerListTasks();
      setTasks(sortTasks(response.items));
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
        return sortTasks([task, ...prev]);
      });
    });

    newSocket.on('task.updated', (task: Task) => {
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === task.id ? task : t)))
      );
    });

    newSocket.on('task.deleted', ({ taskId }: { taskId: string }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    });

    newSocket.on('task.assigned', (task: Task) => {
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === task.id ? task : t)))
      );
    });

    newSocket.on('task.commented', async (comment: Comment) => {
      try {
        const updatedTask = await TaskerooService.taskerooControllerGetTask(comment.taskId);
        setTasks((prev) => {
          const existingTaskIndex = prev.findIndex((t) => t.id === updatedTask.id);
          if (existingTaskIndex === -1) {
            return sortTasks([updatedTask, ...prev]);
          }
          return sortTasks(prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
        });
      } catch (err) {
        console.error('Failed to refresh task after comment', err);
      }
    });

    newSocket.on('task.status_changed', (task: Task) => {
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === task.id ? task : t)))
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