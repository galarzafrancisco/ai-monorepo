import React, { useMemo, useState } from "react";
import { useTaskeroo } from "./useTaskeroo"; // your abstraction hook
import type { Task } from "./types";
import { TaskStatus } from "./const";
import { TaskerooContext, type TaskerooContextValue, type AnimationState } from "./taskeroo-context";
// Helper to create empty animation state for all statuses
const createEmptyAnimationByStatus = (): Record<TaskStatus, AnimationState> => ({
  [TaskStatus.NOT_STARTED]: { enteringIds: new Set(), exitingTasks: [] },
  [TaskStatus.IN_PROGRESS]: { enteringIds: new Set(), exitingTasks: [] },
  [TaskStatus.FOR_REVIEW]: { enteringIds: new Set(), exitingTasks: [] },
  [TaskStatus.DONE]: { enteringIds: new Set(), exitingTasks: [] },
});

export function TaskerooProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: this is where the one websocket connection should be created
  const { tasks, isLoading, error, isConnected } = useTaskeroo();
  const [sectionTitle, setSectionTitle] = useState("");

  const animationByStatus = useMemo(() => createEmptyAnimationByStatus(), []);
  const globalEnteringIds = useMemo(() => new Set<string>(), []);
  const globalExitingTasks = useMemo<Task[]>(() => [], []);

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<TaskerooContextValue>(() => {
    return {
      tasks,
      isLoading,
      error,
      isConnected,
      sectionTitle,
      setSectionTitle,
      animationByStatus,
      globalEnteringIds,
      globalExitingTasks,
    };
  }, [
    tasks,
    isLoading,
    error,
    isConnected,
    sectionTitle,
    setSectionTitle,
    animationByStatus,
    globalEnteringIds,
    globalExitingTasks,
  ]);

  return <TaskerooContext.Provider value={value}>{children}</TaskerooContext.Provider>;
}
