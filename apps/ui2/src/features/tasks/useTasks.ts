import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { TasksService } from './api';
import type { Task } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import type {
  CreateTaskDto,
  AssignTaskDto,
} from "@taico/client/v2"
import {
  TaskWireEvents,
  TaskCreatedWireEvent,
  TaskUpdatedWireEvent,
  TaskDeletedWireEvent,
  TaskAssignedWireEvent,
  TaskStatusChangedWireEvent,
  TaskCommentedWireEvent,
  InputRequestAnsweredWireEvent,
  TaskActivityWireEvent,
} from "@taico/events";

// Use centralized API configuration
const SOCKET_URL = getUIWebSocketUrl('/tasks');
const TASKS_PAGE_SIZE = 100;


export const useTasks = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [tasks, setTasks] = useState<Task[]>([]);

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Ephemeral UI state: last activity per task
  const [activityByTaskId, setActivityByTaskId] = useState<Record<string, TaskActivityWireEvent>>({});

  const upsertActivity = (evt: TaskActivityWireEvent) => {
    // Only store activity if it has a message to display
    if (!evt.message) {
      console.warn('Received task activity event without message, skipping', evt);
      return;
    }
    setActivityByTaskId(prev => ({
      ...prev,
      [evt.taskId]: evt
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
    return await TasksService.TasksController_createTask({ body: task });
  }

  // Delete tasl
  const deleteTask = async ({ taskId }: { taskId: string }) => {
    return await TasksService.TasksController_deleteTask({ id: taskId });
  }

  // Add comment
  const addComment = async ({ taskId, comment }: { taskId: string, comment: string }) => {
    return await TasksService.TasksController_addComment({
      id: taskId,
      body: { content: comment },
    });
  }

  // Assign task
  const assignTask = async ({ taskId, assigneeActorId }: { taskId: string, assigneeActorId: string }) => {
    const dto: AssignTaskDto = { assigneeActorId };
    return await TasksService.TasksController_assignTask({ id: taskId, body: dto });
  }

  // Assign task to me
  const assignTaskToMe = async ({ taskId }: { taskId: string }) => {
    return await TasksService.TasksController_assignTaskToMe({ id: taskId });
  }

  // Answer input request
  const answerInputRequest = async ({ taskId, inputRequestId, answer }: { taskId: string, inputRequestId: string, answer: string }) => {
    return await TasksService.TasksController_answerInputRequest({
      id: taskId,
      inputRequestId,
      body: { answer },
    });
  }

  // Load tasks
  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await TasksService.TasksController_listTasks({
        page: 1,
        limit: TASKS_PAGE_SIZE,
      });
      setTasks(sortTasks(response.items));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setHasLoadedOnce(true);
      setIsLoading(false);
    }
  };

  // Get a single task by ID - checks cache first, then fetches from backend
  // This function is wrapped in useCallback to maintain referential stability,
  // preventing unnecessary re-renders in components that depend on it.
  // We use functional state updates to avoid depending on the tasks state.
  const getTaskById = useCallback(async (taskId: string): Promise<Task | null> => {
    // Try to fetch from backend (it's fast enough and ensures we have the latest data)
    try {
      const task = await TasksService.TasksController_getTask({ id: taskId });
      // Add to cache for future lookups
      setTasks((prev) => {
        // Check if task already exists in cache to avoid duplicates
        if (prev.some(t => t.id === task.id)) {
          // Update existing task in case it changed
          return sortTasks(prev.map(t => t.id === task.id ? task : t));
        }
        // Add new task to cache
        return sortTasks([task, ...prev]);
      });
      return task;
    } catch (err) {
      console.error('Failed to fetch task by ID', err);
      return null;
    }
  }, []); // No dependencies - uses functional state updates

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

    // Handle task created event
    newSocket.on(TaskWireEvents.TASK_CREATED, (event: TaskCreatedWireEvent) => {
      console.log('task.created', event);
      setTasks((prev) => {
        // Avoid duplicates - check if task already exists
        if (prev.some(t => t.id === event.payload.id)) {
          return prev;
        }
        // TODO: this type assertion is to hide a type mismatch!
        return sortTasks([event.payload as Task, ...prev]);
      });
    });

    // Handle task updated event
    newSocket.on(TaskWireEvents.TASK_UPDATED, (event: TaskUpdatedWireEvent) => {
      console.log('task.updated', event);
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === event.payload.id ? event.payload as Task : t)))
      );
    });

    // Handle task deleted event
    newSocket.on(TaskWireEvents.TASK_DELETED, (event: TaskDeletedWireEvent) => {
      console.log('task.deleted', event);
      setTasks((prev) => prev.filter((t) => t.id !== event.payload.taskId));
    });

    // Handle task assigned event
    newSocket.on(TaskWireEvents.TASK_ASSIGNED, (event: TaskAssignedWireEvent) => {
      console.log('task.assigned', event);
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === event.payload.id ? event.payload as Task : t)))
      );
    });

    // Handle comment added event
    newSocket.on(TaskWireEvents.TASK_COMMENTED, async (event: TaskCommentedWireEvent) => {
      console.log('task.commented', event);
      try {
        // event.payload is CommentWirePayload with taskId
        const updatedTask = await TasksService.TasksController_getTask({ id: event.payload.taskId });
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

    // Handle input request answered event
    newSocket.on(TaskWireEvents.INPUT_REQUEST_ANSWERED, async (event: InputRequestAnsweredWireEvent) => {
      console.log('input.request.answered', event);
      try {
        const updatedTask = await TasksService.TasksController_getTask({ id: event.payload.taskId });
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

    // Handle task status changed event
    newSocket.on(TaskWireEvents.TASK_STATUS_CHANGED, (event: TaskStatusChangedWireEvent) => {
      console.log('task.status_changed', event);
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === event.payload.id ? event.payload as Task : t)))
      );
    });

    // Handle task activity event (ephemeral UI feedback, not persisted)
    newSocket.on(TaskWireEvents.TASK_ACTIVITY, (evt: TaskActivityWireEvent) => {
      console.log('task.activity', evt);
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
    hasLoadedOnce,
    error,
    activityByTaskId,

    // Data
    tasks,
    getTaskById,
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
