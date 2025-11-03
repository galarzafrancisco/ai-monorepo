import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Task {
  id: string;
  name: string;
  description: string;
  status: 'not started' | 'in progress' | 'for review' | 'done';
  assignee: string | null;
  sessionId: string | null;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  commenterName: string;
  content: string;
  createdAt: string;
}

export function useTaskerooSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3000/taskeroo', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('task.created', (task: Task) => {
      setTasks((prev) => [task, ...prev]);
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
  }, []);

  return { socket, tasks, setTasks, connected };
}
