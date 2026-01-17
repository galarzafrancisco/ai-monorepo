import { createContext, useContext } from "react";
import type { Task } from "./types";
import type { TaskStatus } from "./const";

export type AnimationState = {
  enteringIds: Set<string>;
  exitingTasks: Task[];
};

export type TaskerooContextValue = {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  animationByStatus: Record<TaskStatus, AnimationState>;
  globalEnteringIds: Set<string>;
  globalExitingTasks: Task[];
};

export const TaskerooContext = createContext<TaskerooContextValue | null>(null);

export function useTaskerooCtx(): TaskerooContextValue {
  const ctx = useContext(TaskerooContext);
  if (!ctx) {
    throw new Error("useTaskerooCtx must be used within <TaskerooProvider>");
  }
  return ctx;
}
