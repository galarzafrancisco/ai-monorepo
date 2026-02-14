import { useCallback, useEffect, useState } from 'react';
import { ScheduledTasksService, TaskBlueprintsService } from './api';
import type { ScheduledTask, TaskBlueprint } from './types';
import type {
  CreateScheduledTaskDto,
  CreateTaskBlueprintDto,
  UpdateScheduledTaskDto,
  UpdateTaskBlueprintDto,
} from '@taico/client';

const PAGE_SIZE = 100;

export const useScheduledTasks = () => {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [blueprintsById, setBlueprintsById] = useState<Record<string, TaskBlueprint>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsertBlueprint = useCallback((blueprint: TaskBlueprint) => {
    setBlueprintsById((prev) => ({
      ...prev,
      [blueprint.id]: blueprint,
    }));
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
      const response = await ScheduledTasksService.scheduledTasksControllerListScheduledTasks(1, PAGE_SIZE);
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
    const task = await ScheduledTasksService.scheduledTasksControllerGetScheduledTask(id);
    upsertScheduledTask(task);
    if (task.taskBlueprint) {
      upsertBlueprint(task.taskBlueprint);
    }
    return task;
  }, [upsertScheduledTask, upsertBlueprint]);

  const loadBlueprint = useCallback(async (id: string) => {
    const blueprint = await TaskBlueprintsService.taskBlueprintsControllerGetTaskBlueprint(id);
    upsertBlueprint(blueprint);
    return blueprint;
  }, [upsertBlueprint]);

  const createBlueprint = useCallback(async (payload: CreateTaskBlueprintDto) => {
    const blueprint = await TaskBlueprintsService.taskBlueprintsControllerCreateTaskBlueprint(payload);
    upsertBlueprint(blueprint);
    return blueprint;
  }, [upsertBlueprint]);

  const updateBlueprint = useCallback(async (id: string, payload: UpdateTaskBlueprintDto) => {
    const blueprint = await TaskBlueprintsService.taskBlueprintsControllerUpdateTaskBlueprint(id, payload);
    upsertBlueprint(blueprint);
    return blueprint;
  }, [upsertBlueprint]);

  const createScheduledTask = useCallback(async (payload: CreateScheduledTaskDto) => {
    const task = await ScheduledTasksService.scheduledTasksControllerCreateScheduledTask(payload);
    upsertScheduledTask(task);
    if (task.taskBlueprint) {
      upsertBlueprint(task.taskBlueprint);
    }
    return task;
  }, [upsertScheduledTask, upsertBlueprint]);

  const updateScheduledTask = useCallback(async (id: string, payload: UpdateScheduledTaskDto) => {
    const task = await ScheduledTasksService.scheduledTasksControllerUpdateScheduledTask(id, payload);
    upsertScheduledTask(task);
    if (task.taskBlueprint) {
      upsertBlueprint(task.taskBlueprint);
    }
    return task;
  }, [upsertScheduledTask, upsertBlueprint]);

  const deleteScheduledTask = useCallback(async (id: string) => {
    await ScheduledTasksService.scheduledTasksControllerDeleteScheduledTask(id);
    setScheduledTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  useEffect(() => {
    loadScheduledTasks();
  }, [loadScheduledTasks]);

  return {
    scheduledTasks,
    blueprintsById,
    isLoading,
    error,
    loadScheduledTasks,
    loadScheduledTask,
    loadBlueprint,
    createBlueprint,
    updateBlueprint,
    createScheduledTask,
    updateScheduledTask,
    deleteScheduledTask,
  };
};
