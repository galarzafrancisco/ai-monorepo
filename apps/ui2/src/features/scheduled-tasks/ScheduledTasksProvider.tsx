import React, { createContext, useContext, useMemo, useState } from 'react';
import { useScheduledTasks } from './useScheduledTasks';
import type { ScheduledTask, TaskBlueprint } from './types';
import type {
  CreateScheduledTaskDto,
  CreateTaskBlueprintDto,
  UpdateScheduledTaskDto,
  UpdateTaskBlueprintDto,
} from '@taico/client';

export type ScheduledTasksContextValue = {
  scheduledTasks: ScheduledTask[];
  blueprints: TaskBlueprint[];
  blueprintsById: Record<string, TaskBlueprint>;
  isLoading: boolean;
  error: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  loadScheduledTasks: () => Promise<void>;
  loadScheduledTask: (id: string) => Promise<ScheduledTask>;
  loadBlueprint: (id: string) => Promise<TaskBlueprint>;
  loadBlueprints: () => Promise<void>;
  createBlueprint: (payload: CreateTaskBlueprintDto) => Promise<TaskBlueprint>;
  updateBlueprint: (id: string, payload: UpdateTaskBlueprintDto) => Promise<TaskBlueprint>;
  createScheduledTask: (payload: CreateScheduledTaskDto) => Promise<ScheduledTask>;
  updateScheduledTask: (id: string, payload: UpdateScheduledTaskDto) => Promise<ScheduledTask>;
  deleteScheduledTask: (id: string) => Promise<void>;
  deleteBlueprint: (id: string) => Promise<void>;
};

const ScheduledTasksContext = createContext<ScheduledTasksContextValue | null>(null);

export function ScheduledTasksProvider({ children }: { children: React.ReactNode }) {
  const {
    scheduledTasks,
    blueprints,
    blueprintsById,
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
  } = useScheduledTasks();

  const [sectionTitle, setSectionTitle] = useState('');

  const value = useMemo<ScheduledTasksContextValue>(() => ({
    scheduledTasks,
    blueprints,
    blueprintsById,
    isLoading,
    error,
    sectionTitle,
    setSectionTitle,
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
  }), [
    scheduledTasks,
    blueprints,
    blueprintsById,
    isLoading,
    error,
    sectionTitle,
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
  ]);

  return (
    <ScheduledTasksContext.Provider value={value}>
      {children}
    </ScheduledTasksContext.Provider>
  );
}

export function useScheduledTasksCtx(): ScheduledTasksContextValue {
  const ctx = useContext(ScheduledTasksContext);
  if (!ctx) {
    throw new Error('useScheduledTasksCtx must be used within <ScheduledTasksProvider>');
  }
  return ctx;
}
