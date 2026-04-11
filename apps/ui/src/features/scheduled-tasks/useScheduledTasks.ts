import { useCallback, useEffect, useState } from 'react';
import { ScheduledTasksService, TaskBlueprintsService } from './api';
import type { ScheduledTask, TaskBlueprint } from './types';
import type {
  CreateScheduledTaskDto,
  CreateTaskBlueprintDto,
  UpdateScheduledTaskDto,
  UpdateTaskBlueprintDto,
} from '@taico/client/v2';

const PAGE_SIZE = 100;

export const useScheduledTasks = () => {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [blueprintsById, setBlueprintsById] = useState<Record<string, TaskBlueprint>>({});
  const [blueprints, setBlueprints] = useState<TaskBlueprint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsertBlueprint = useCallback((blueprint: TaskBlueprint) => {
    setBlueprintsById((prev) => ({
      ...prev,
      [blueprint.id]: blueprint,
    }));
    setBlueprints((prev) => {
      const exists = prev.some((item) => item.id === blueprint.id);
      if (exists) {
        return prev.map((item) => (item.id === blueprint.id ? blueprint : item));
      }
      return [blueprint, ...prev];
    });
  }, []);

  const upsertScheduledTask = useCallback((task: ScheduledTask) => {
    setScheduledTasks((prev) => {
      const existing = prev.find((item) => item.id === task.id);
      if (!existing) {
        return [task, ...prev];
      }
      return prev.map((item) => (item.id === task.id ? task : item));
    });
  }, []);

  const loadScheduledTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ScheduledTasksService.ScheduledTasksController_listScheduledTasks({ page: 1, limit: PAGE_SIZE });
      setScheduledTasks(response.items);
      response.items.forEach((item) => {
        if (item.taskBlueprint) {
          upsertBlueprint(item.taskBlueprint);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled tasks');
    } finally {
      setIsLoading(false);
    }
  }, [upsertBlueprint]);

  const loadScheduledTask = useCallback(async (id: string) => {
    const task = await ScheduledTasksService.ScheduledTasksController_getScheduledTask({ id });
    upsertScheduledTask(task);
    if (task.taskBlueprint) {
      upsertBlueprint(task.taskBlueprint);
    }
    return task;
  }, [upsertScheduledTask, upsertBlueprint]);

  const loadBlueprint = useCallback(async (id: string) => {
    const blueprint = await TaskBlueprintsService.TaskBlueprintsController_getTaskBlueprint({ id });
    upsertBlueprint(blueprint);
    return blueprint;
  }, [upsertBlueprint]);

  const loadBlueprints = useCallback(async () => {
    setError(null);
    try {
      const response = await TaskBlueprintsService.TaskBlueprintsController_listTaskBlueprints({ page: 1, limit: PAGE_SIZE });
      setBlueprints(response.items);
      response.items.forEach((item) => upsertBlueprint(item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task blueprints');
    }
  }, [upsertBlueprint]);

  const createBlueprint = useCallback(async (payload: CreateTaskBlueprintDto) => {
    const blueprint = await TaskBlueprintsService.TaskBlueprintsController_createTaskBlueprint({ body: payload });
    upsertBlueprint(blueprint);
    return blueprint;
  }, [upsertBlueprint]);

  const updateBlueprint = useCallback(async (id: string, payload: UpdateTaskBlueprintDto) => {
    const blueprint = await TaskBlueprintsService.TaskBlueprintsController_updateTaskBlueprint({ id, body: payload });
    upsertBlueprint(blueprint);
    return blueprint;
  }, [upsertBlueprint]);

  const createScheduledTask = useCallback(async (payload: CreateScheduledTaskDto) => {
    const task = await ScheduledTasksService.ScheduledTasksController_createScheduledTask({ body: payload });
    upsertScheduledTask(task);
    if (task.taskBlueprint) {
      upsertBlueprint(task.taskBlueprint);
    }
    return task;
  }, [upsertScheduledTask, upsertBlueprint]);

  const updateScheduledTask = useCallback(async (id: string, payload: UpdateScheduledTaskDto) => {
    const task = await ScheduledTasksService.ScheduledTasksController_updateScheduledTask({ id, body: payload });
    upsertScheduledTask(task);
    if (task.taskBlueprint) {
      upsertBlueprint(task.taskBlueprint);
    }
    return task;
  }, [upsertScheduledTask, upsertBlueprint]);

  const deleteScheduledTask = useCallback(async (id: string) => {
    await ScheduledTasksService.ScheduledTasksController_deleteScheduledTask({ id });
    setScheduledTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const deleteBlueprint = useCallback(async (id: string) => {
    await TaskBlueprintsService.TaskBlueprintsController_deleteTaskBlueprint({ id });
    setBlueprints((prev) => prev.filter((item) => item.id !== id));
    setBlueprintsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    loadScheduledTasks();
  }, [loadScheduledTasks]);

  return {
    scheduledTasks,
    blueprintsById,
    blueprints,
    isLoading,
    error,
    loadScheduledTasks,
    loadScheduledTask,
    loadBlueprint,
    loadBlueprints,
    createBlueprint,
    updateBlueprint,
    createScheduledTask,
    updateScheduledTask,
    deleteScheduledTask,
    deleteBlueprint,
  };
};
