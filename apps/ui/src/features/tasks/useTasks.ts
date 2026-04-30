import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ProjectsService, TasksService } from './api';
import type { Task } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import type {
  CreateTaskDto,
  AssignTaskDto,
  ProjectResponseDto,
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
const SELECTED_PROJECT_STORAGE_KEY = 'tasks.selectedProjectId';

function readStoredSelectedProjectId(): string | null {
  try {
    return localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function taskHasTag(task: Pick<Task, 'tags'>, tagName: string): boolean {
  return task.tags.some((tag) => tag.name === tagName);
}

export const useTasks = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [tasks, setTasks] = useState<Task[]>([]);
  const [detailTasks, setDetailTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectResponseDto[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() => readStoredSelectedProjectId());

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Ephemeral UI state: last activity per task
  const [activityByTaskId, setActivityByTaskId] = useState<Record<string, TaskActivityWireEvent>>({});
  const tasksRef = useRef<Task[]>([]);
  const selectedProjectTagRef = useRef<string | null>(null);
  const isProjectSelectionReadyRef = useRef(false);
  const loadTasksRequestIdRef = useRef(0);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) {
      return null;
    }
    return projects.find((project) => project.id === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  const selectedProjectTag = selectedProject?.tagName ?? null;
  const isProjectSelectionReady = !selectedProjectId || Boolean(selectedProject);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    selectedProjectTagRef.current = selectedProjectTag;
  }, [selectedProjectTag]);

  useEffect(() => {
    isProjectSelectionReadyRef.current = isProjectSelectionReady;
  }, [isProjectSelectionReady]);

  const setSelectedProjectId = useCallback((projectId: string | null) => {
    setSelectedProjectIdState(projectId);
    try {
      if (projectId) {
        localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
      } else {
        localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Failed to persist selected task project', err);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const response = await ProjectsService.ProjectsController_getAllProjects();
      setProjects(response);
    } catch (err) {
      console.error('Failed to load projects', err);
      setProjects([]);
    } finally {
      setProjectsLoaded(true);
    }
  }, []);

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

  // Sort tasks by updatedAt (newest first)
  const sortTasks = (tasks: Task[]): Task[] => {
    return [...tasks].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  };

  const mergeTasks = (existingTasks: Task[], incomingTasks: Task[]): Task[] => {
    const incomingIds = new Set(incomingTasks.map(task => task.id));
    return sortTasks([
      ...incomingTasks,
      ...existingTasks.filter(task => !incomingIds.has(task.id)),
    ]);
  };

  const cacheDetailTask = (task: Task) => {
    setDetailTasks((prev) => mergeTasks(prev, [task]));
  };

  // Create task
  const createTask = async (task: CreateTaskDto) => {
    const projectTag = selectedProjectTagRef.current;
    const body: CreateTaskDto = projectTag
      ? {
        ...task,
        tagNames: Array.from(new Set([...(task.tagNames ?? []), projectTag])),
      }
      : task;
    return await TasksService.TasksController_createTask({ body });
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
    if (!isProjectSelectionReadyRef.current) {
      return;
    }
    const requestId = loadTasksRequestIdRef.current + 1;
    loadTasksRequestIdRef.current = requestId;
    const requestedProjectTag = selectedProjectTagRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await TasksService.TasksController_listTasks({
        page: 1,
        limit: TASKS_PAGE_SIZE,
        tag: requestedProjectTag ?? undefined,
      });
      if (loadTasksRequestIdRef.current !== requestId || selectedProjectTagRef.current !== requestedProjectTag) {
        return;
      }

      const visibleItems = requestedProjectTag
        ? response.items.filter((task) => taskHasTag(task, requestedProjectTag))
        : response.items;
      setTasks(prev => mergeTasks(prev, visibleItems));
    } catch (err) {
      if (loadTasksRequestIdRef.current !== requestId || selectedProjectTagRef.current !== requestedProjectTag) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      if (loadTasksRequestIdRef.current === requestId && selectedProjectTagRef.current === requestedProjectTag) {
        setHasLoadedOnce(true);
        setIsLoading(false);
      }
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
      cacheDetailTask(task);
      // Only project-matching hydrated tasks belong in the board/list cache.
      setTasks((prev) => {
        if (!taskMatchesSelectedProject(task)) {
          return prev.filter(t => t.id !== task.id);
        }
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
  }, []); // No dependencies - uses refs and functional state updates

  const taskMatchesSelectedProject = (task: Task): boolean => {
    const selectedTag = selectedProjectTagRef.current;
    return !selectedTag || taskHasTag(task, selectedTag);
  };

  const isVisibleTaskId = (taskId: string): boolean => {
    const selectedTag = selectedProjectTagRef.current;
    if (!selectedTag) {
      return true;
    }
    return tasksRef.current.some((task) => task.id === taskId && taskHasTag(task, selectedTag));
  };

  const upsertTaskFromEvent = (task: Task) => {
    cacheDetailTask(task);

    if (!taskMatchesSelectedProject(task)) {
      setTasks((prev) => prev.filter((existingTask) => existingTask.id !== task.id));
      clearActivity(task.id);
      return;
    }

    setTasks((prev) => {
      if (prev.some((existingTask) => existingTask.id === task.id)) {
        return sortTasks(prev.map((existingTask) => (existingTask.id === task.id ? task : existingTask)));
      }
      return sortTasks([task, ...prev]);
    });
  };

  const removeTaskFromCaches = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setDetailTasks((prev) => prev.filter((task) => task.id !== taskId));
    clearActivity(taskId);
  };

  const refreshTaskFromEvent = async (taskId: string, errorMessage: string) => {
    try {
      const updatedTask = await TasksService.TasksController_getTask({ id: taskId });
      upsertTaskFromEvent(updatedTask);
    } catch (err) {
      console.error(errorMessage, err);
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

    // Handle task created event
    newSocket.on(TaskWireEvents.TASK_CREATED, (event: TaskCreatedWireEvent) => {
      console.log('task.created', event);
      upsertTaskFromEvent(event.payload as Task);
    });

    // Handle task updated event
    newSocket.on(TaskWireEvents.TASK_UPDATED, (event: TaskUpdatedWireEvent) => {
      console.log('task.updated', event);
      upsertTaskFromEvent(event.payload as Task);
    });

    // Handle task deleted event
    newSocket.on(TaskWireEvents.TASK_DELETED, (event: TaskDeletedWireEvent) => {
      console.log('task.deleted', event);
      removeTaskFromCaches(event.payload.taskId);
    });

    // Handle task assigned event
    newSocket.on(TaskWireEvents.TASK_ASSIGNED, (event: TaskAssignedWireEvent) => {
      console.log('task.assigned', event);
      upsertTaskFromEvent(event.payload as Task);
    });

    // Handle comment added event
    newSocket.on(TaskWireEvents.TASK_COMMENTED, async (event: TaskCommentedWireEvent) => {
      console.log('task.commented', event);
      await refreshTaskFromEvent(event.payload.taskId, 'Failed to refresh task after comment');
    });

    // Handle input request answered event
    newSocket.on(TaskWireEvents.INPUT_REQUEST_ANSWERED, async (event: InputRequestAnsweredWireEvent) => {
      console.log('input.request.answered', event);
      await refreshTaskFromEvent(event.payload.taskId, 'Failed to refresh task after input request answer');
    });

    // Handle task status changed event
    newSocket.on(TaskWireEvents.TASK_STATUS_CHANGED, (event: TaskStatusChangedWireEvent) => {
      console.log('task.status_changed', event);
      upsertTaskFromEvent(event.payload as Task);
    });

    // Handle task activity event (ephemeral UI feedback, not persisted)
    newSocket.on(TaskWireEvents.TASK_ACTIVITY, (evt: TaskActivityWireEvent) => {
      console.log('task.activity', evt);
      if (!isVisibleTaskId(evt.taskId)) {
        return;
      }
      upsertActivity(evt);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  };

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SELECTED_PROJECT_STORAGE_KEY) {
        setSelectedProjectIdState(event.newValue);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!projectsLoaded || !selectedProjectId || selectedProject) {
      return;
    }
    setSelectedProjectId(null);
  }, [projectsLoaded, selectedProject, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (!isProjectSelectionReady) {
      return;
    }

    setTasks([]);
    setActivityByTaskId({});
    loadTasks();
    const cleanup = setupWebsocket();
    return cleanup;
  }, [isProjectSelectionReady, selectedProjectTag]);

  return {
    // UI feedback
    isLoading,
    hasLoadedOnce,
    error,
    activityByTaskId,
    projects,
    projectsLoaded,
    selectedProjectId,
    selectedProject,
    selectedProjectTag,
    setSelectedProjectId,

    // Data
    tasks,
    detailTasks,
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
