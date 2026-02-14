import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { TasksService } from './api';
import { ProjectsService } from '../projects/api';
import type { Task } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import type {
  CreateTaskDto,
  AssignTaskDto,
  ProjectResponseDto,
} from '@taico/client';
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
} from '@taico/events';

const SOCKET_URL = getUIWebSocketUrl('/tasks');
const TASKS_PAGE_SIZE = 100;
const PROJECT_QUERY_PARAM = 'project';
const PROJECT_STORAGE_KEY = 'tasks:selected-project-slug';
const LEGACY_PROJECT_STORAGE_KEY = 'tasks:selected-project-id';
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const useTasks = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activityByTaskId, setActivityByTaskId] = useState<Record<string, TaskActivityWireEvent>>({});
  const [projects, setProjects] = useState<ProjectResponseDto[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const selectedProjectParamFromUrl = searchParams.get(PROJECT_QUERY_PARAM);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) =>
          project.slug === selectedProjectParamFromUrl || project.id === selectedProjectParamFromUrl,
      ) ?? null,
    [projects, selectedProjectParamFromUrl],
  );

  const selectedProjectTagName = useMemo(() => {
    if (selectedProject?.tagName) {
      return selectedProject.tagName;
    }
    if (!selectedProjectParamFromUrl || UUID_V4_PATTERN.test(selectedProjectParamFromUrl)) {
      return undefined;
    }
    return `project:${selectedProjectParamFromUrl}`;
  }, [selectedProject, selectedProjectParamFromUrl]);
  const tasksRef = useRef<Task[]>([]);

  const sortTasks = (items: Task[]): Task[] => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
  };

  const taskMatchesSelectedProject = useCallback(
    (task: { tags?: { name: string }[] }) => {
      if (!selectedProjectTagName) {
        return true;
      }
      return task.tags?.some((tag) => tag.name === selectedProjectTagName) ?? false;
    },
    [selectedProjectTagName],
  );

  const setSelectedProjectId = useCallback(
    (projectSlug: string | null, options?: { replace?: boolean }) => {
      const next = new URLSearchParams(location.search);
      if (projectSlug) {
        next.set(PROJECT_QUERY_PARAM, projectSlug);
        window.localStorage.setItem(PROJECT_STORAGE_KEY, projectSlug);
        window.localStorage.removeItem(LEGACY_PROJECT_STORAGE_KEY);
      } else {
        next.delete(PROJECT_QUERY_PARAM);
        window.localStorage.removeItem(PROJECT_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_PROJECT_STORAGE_KEY);
      }
      setSearchParams(next, { replace: options?.replace ?? false });
    },
    [location.search, setSearchParams],
  );

  const upsertActivity = (evt: TaskActivityWireEvent) => {
    if (!evt.message) {
      return;
    }
    setActivityByTaskId((prev) => ({
      ...prev,
      [evt.taskId]: evt,
    }));
  };

  const createTask = async (task: CreateTaskDto) => {
    const tagNames = new Set(task.tagNames ?? []);
    if (selectedProjectTagName) {
      tagNames.add(selectedProjectTagName);
    }

    return await TasksService.tasksControllerCreateTask({
      ...task,
      tagNames: tagNames.size > 0 ? Array.from(tagNames) : undefined,
    });
  };

  const deleteTask = async ({ taskId }: { taskId: string }) => {
    return await TasksService.tasksControllerDeleteTask(taskId);
  };

  const addComment = async ({ taskId, comment }: { taskId: string; comment: string }) => {
    return await TasksService.tasksControllerAddComment(taskId, { content: comment });
  };

  const assignTask = async ({ taskId, assigneeActorId }: { taskId: string; assigneeActorId: string }) => {
    const dto: AssignTaskDto = { assigneeActorId };
    return await TasksService.tasksControllerAssignTask(taskId, dto);
  };

  const assignTaskToMe = async ({ taskId }: { taskId: string }) => {
    return await TasksService.tasksControllerAssignTaskToMe(taskId);
  };

  const answerInputRequest = async ({
    taskId,
    inputRequestId,
    answer,
  }: {
    taskId: string;
    inputRequestId: string;
    answer: string;
  }) => {
    return await TasksService.tasksControllerAnswerInputRequest(taskId, inputRequestId, { answer });
  };

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await TasksService.tasksControllerListTasks(
        undefined,
        undefined,
        selectedProjectTagName,
        1,
        TASKS_PAGE_SIZE,
      );
      setTasks(sortTasks(response.items));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectTagName]);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);
    try {
      const allProjects = await ProjectsService.projectsControllerGetAllProjects();
      setProjects(allProjects);
    } catch (err: any) {
      setProjectsError(err?.body?.detail ?? 'Failed to load projects');
    } finally {
      setProjectsLoaded(true);
      setIsLoadingProjects(false);
    }
  }, []);

  const setupWebsocket = useCallback(() => {
    const newSocket: Socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const upsertOrRemoveTask = (task: Task) => {
      setTasks((prev) => {
        if (!taskMatchesSelectedProject(task)) {
          return prev.filter((existingTask) => existingTask.id !== task.id);
        }
        const exists = prev.some((existingTask) => existingTask.id === task.id);
        if (!exists) {
          return sortTasks([task, ...prev]);
        }
        return sortTasks(prev.map((existingTask) => (existingTask.id === task.id ? task : existingTask)));
      });
    };

    newSocket.on('connect', () => {
      newSocket.emit('tasks.subscribe', {}, (ack: any) => {
        setIsConnected(Boolean(ack?.ok));
      });
      loadTasks();
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on(TaskWireEvents.TASK_CREATED, (event: TaskCreatedWireEvent) => {
      const task = event.payload as Task;
      if (!taskMatchesSelectedProject(task)) {
        return;
      }
      setTasks((prev) => {
        if (prev.some((existingTask) => existingTask.id === task.id)) {
          return prev;
        }
        return sortTasks([task, ...prev]);
      });
    });

    newSocket.on(TaskWireEvents.TASK_UPDATED, (event: TaskUpdatedWireEvent) => {
      upsertOrRemoveTask(event.payload as Task);
    });

    newSocket.on(TaskWireEvents.TASK_DELETED, (event: TaskDeletedWireEvent) => {
      setTasks((prev) => prev.filter((task) => task.id !== event.payload.taskId));
      setActivityByTaskId((prev) => {
        const { [event.payload.taskId]: _, ...rest } = prev;
        return rest;
      });
    });

    newSocket.on(TaskWireEvents.TASK_ASSIGNED, (event: TaskAssignedWireEvent) => {
      upsertOrRemoveTask(event.payload as Task);
    });

    newSocket.on(TaskWireEvents.TASK_COMMENTED, async (event: TaskCommentedWireEvent) => {
      try {
        const updatedTask = await TasksService.tasksControllerGetTask(event.payload.taskId);
        upsertOrRemoveTask(updatedTask);
      } catch {
        // Ignore refresh errors from transient fetches.
      }
    });

    newSocket.on(TaskWireEvents.INPUT_REQUEST_ANSWERED, async (event: InputRequestAnsweredWireEvent) => {
      try {
        const updatedTask = await TasksService.tasksControllerGetTask(event.payload.taskId);
        upsertOrRemoveTask(updatedTask);
      } catch {
        // Ignore refresh errors from transient fetches.
      }
    });

    newSocket.on(TaskWireEvents.TASK_STATUS_CHANGED, (event: TaskStatusChangedWireEvent) => {
      upsertOrRemoveTask(event.payload as Task);
    });

    newSocket.on(TaskWireEvents.TASK_ACTIVITY, (evt: TaskActivityWireEvent) => {
      const shouldKeepEvent = tasksRef.current.some((task) => task.id === evt.taskId);
      if (!shouldKeepEvent) {
        return;
      }
      upsertActivity(evt);
    });

    return () => {
      newSocket.close();
    };
  }, [loadTasks, taskMatchesSelectedProject]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const projectFromUrl = new URLSearchParams(location.search).get(PROJECT_QUERY_PARAM);
    if (projectFromUrl) {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, projectFromUrl);
      window.localStorage.removeItem(LEGACY_PROJECT_STORAGE_KEY);
      return;
    }

    const storedProjectSlug =
      window.localStorage.getItem(PROJECT_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY);
    if (!storedProjectSlug) {
      return;
    }

    const next = new URLSearchParams(location.search);
    next.set(PROJECT_QUERY_PARAM, storedProjectSlug);
    setSearchParams(next, { replace: true });
  }, [location.search, setSearchParams]);

  useEffect(() => {
    if (!projectsLoaded || !selectedProjectParamFromUrl) {
      return;
    }

    if (selectedProject) {
      if (selectedProject.slug !== selectedProjectParamFromUrl) {
        setSelectedProjectId(selectedProject.slug, { replace: true });
      }
      return;
    }

    const existsAsSlug = projects.some((project) => project.slug === selectedProjectParamFromUrl);
    if (!existsAsSlug) {
      setSelectedProjectId(null, { replace: true });
    }
  }, [
    projects,
    projectsLoaded,
    selectedProject,
    selectedProjectParamFromUrl,
    setSelectedProjectId,
  ]);

  useEffect(() => {
    setActivityByTaskId({});
    loadTasks();
    const cleanup = setupWebsocket();
    return cleanup;
  }, [loadTasks, setupWebsocket]);

  return {
    isLoading,
    error,
    activityByTaskId,
    tasks,
    createTask,
    deleteTask,
    addComment,
    assignTask,
    assignTaskToMe,
    answerInputRequest,
    isConnected,
    projects,
    selectedProjectId: selectedProject?.slug ?? selectedProjectParamFromUrl,
    selectedProject,
    setSelectedProjectId,
    isLoadingProjects,
    projectsError,
  };
};
