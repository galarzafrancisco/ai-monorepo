import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { TasksService } from './api';
import type { Task } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import { CreateTaskDto, AssignTaskDto } from 'shared';

// TODO
// the websocket gateway sends full entities, not DTOs wich might vary in shape.
// Tasks seem to be fine but Comments are different.
// We need to type the websocket events.

// Use centralized API configuration
const SOCKET_URL = getUIWebSocketUrl('/tasks');
const TASKS_PAGE_SIZE = 100;


type TaskActivityEvent = {
  taskId: string;
  message: string;
  ts?: string; // optional if server provides
};

export type TaskActivityItem = {
  message: string;
  ts: number;
};


export const useTasks = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [tasks, setTasks] = useState<Task[]>([]);

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Ephemeral UI state: last activity per task
  const [activityByTaskId, setActivityByTaskId] = useState<Record<string, TaskActivityItem>>({});

  const upsertActivity = (evt: TaskActivityEvent) => {
    setActivityByTaskId(prev => ({
      ...prev,
      [evt.taskId]: {
        message: evt.message,
        ts: evt.ts ? new Date(evt.ts).getTime() : Date.now(),
      }
    }));
  };

  // Optional: clear activity when task changes / gets refreshed
  const clearActivity = (taskId: string) => {
    setActivityByTaskId(prev => {
      const { [taskId]: _, ...rest } = prev;
      return rest;
    });
  };
  
  // Boot
  useEffect(() => {
    loadTasks();
    const cleanup = setupWebsocket();
    return cleanup;
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
    return await TasksService.tasksControllerCreateTask(task);
  }

  // Delete tasl
  const deleteTask = async ({ taskId }: { taskId: string }) => {
    return await TasksService.tasksControllerDeleteTask(taskId);
  }

  // Add comment
  const addComment = async ({ taskId, comment }: { taskId: string, comment: string }) => {
    return await TasksService.tasksControllerAddComment(taskId, { content: comment });
  }

  // Assign task
  const assignTask = async ({ taskId, assigneeActorId }: { taskId: string, assigneeActorId: string }) => {
    const dto: AssignTaskDto = { assigneeActorId };
    return await TasksService.tasksControllerAssignTask(taskId, dto);
  }

  // Assign task to me
  const assignTaskToMe = async ({ taskId }: { taskId: string }) => {
    return await TasksService.tasksControllerAssignTaskToMe(taskId);
  }

  // Answer input request
  const answerInputRequest = async ({ taskId, inputRequestId, answer }: { taskId: string, inputRequestId: string, answer: string }) => {
    return await TasksService.tasksControllerAnswerInputRequest(taskId, inputRequestId, { answer });
  }

  // Load tasks
  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await TasksService.tasksControllerListTasks(undefined, undefined, undefined, 1, TASKS_PAGE_SIZE);
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
      newSocket.emit('tasks.subscribe', {}, (ack: any) => {
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
        const updatedTask = await TasksService.tasksControllerGetTask(comment.task.id);
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

    newSocket.on('input.request.answered', async (inputRequest: { taskId: string }) => {
      console.log('input.request.answered');
      try {
        const updatedTask = await TasksService.tasksControllerGetTask(inputRequest.taskId);
        setTasks((prev) => {
          const existingTaskIndex = prev.findIndex((t) => t.id === updatedTask.id);
          if (existingTaskIndex === -1) {
            return sortTasks([updatedTask, ...prev]);
          }
          return sortTasks(prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
        });
      } catch (err) {
        console.error('Failed to refresh task after input request answer', err);
      }
    });

    newSocket.on('task.status_changed', (task: Task) => {
      console.log('task.status_changed');
      console.log(task);

      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === task.id ? task : t)))
      );
    });

    newSocket.on('task.activity', (evt: { taskId: string, message: string }) => {
      // Need to pipe this to my component
      upsertActivity(evt);
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
    activityByTaskId,

    // Data
    tasks,
    createTask,
    deleteTask,
    addComment,
    assignTask,
    assignTaskToMe,
    answerInputRequest,


    // Transport
    isConnected,
  };
};
