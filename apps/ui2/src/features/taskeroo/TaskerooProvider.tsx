import React, { createContext, useContext, useMemo } from "react";
import { useTaskeroo } from "./useTaskeroo"; // your abstraction hook
import type { Task } from "./types";

// Shape this to match what pages/layout need.
export type TaskerooContextValue = {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
};

const TaskerooContext = createContext<TaskerooContextValue | null>(null);

export function TaskerooProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: this is where the one websocket connection should be created
  const { tasks, isLoading, error, isConnected } = useTaskeroo();

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<TaskerooContextValue>(() => {
    return {
      tasks,
      isLoading,
      error,
      isConnected,
    };
  }, [
    tasks,
    isLoading,
    error,
    isConnected,
  ]);

  return <TaskerooContext.Provider value={value}>{children}</TaskerooContext.Provider>;
}

export function useTaskerooCtx(): TaskerooContextValue {
  const ctx = useContext(TaskerooContext);
  if (!ctx) throw new Error("useTaskerooCtx must be used within <TaskerooProvider>");
  return ctx;
}
