import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { TaskerooService } from './api';
import type { Task } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import { CreateTaskDto } from 'shared';

// TODO
// the websocket gateway sends full entities, not DTOs wich might vary in shape.
// Tasks seem to be fine but Comments are different.
// We need to type the websocket events.

// Use centralized API configuration
const SOCKET_URL = getUIWebSocketUrl('/taskeroo');

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

  // Create task
  const createTask = async (task: CreateTaskDto) => {
    return await TaskerooService.taskerooControllerCreateTask(task);
  }

  // Delete tasl
  const deleteTask = async({taskId}: {taskId: string}) => {
    return await TaskerooService.taskerooControllerDeleteTask(taskId);
  }

  // Add comment
  const addComment = async ({ taskId, comment }: { taskId: string, comment: string }) => {
    return await TaskerooService.taskerooControllerAddComment(taskId, { content: comment });
  }

  // Load tasks
  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await TaskerooService.taskerooControllerListTasks();
      setTasks(sortTasks(response.items));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
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
      console.log('Connected to websocket');
      newSocket.emit('taskeroo.subscribe', {}, (ack: any) => {
        if (ack.ok) {
          console.log(ack);
          console.log('Subscribed to room:', ack.room);
          setIsConnected(true);
        } else {
          console.error('Failed to subscribe to room');
          setIsConnected(false);
        }
      });
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
      console.log('task.updated');
      console.log(task);
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

    newSocket.on('task.commented', async (comment: { task: { id: string } }) => {
      console.log('task.commented');
      console.log(comment);
      console.log(comment.task.id);
      try {
        const updatedTask = await TaskerooService.taskerooControllerGetTask(comment.task.id);
        console.log(`updatedTask`);
        console.log(updatedTask);
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
      console.log('task.status_changed');
      console.log(task);

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
    createTask,
    deleteTask,
    addComment,

    // Transport
    isConnected,
  };
};
