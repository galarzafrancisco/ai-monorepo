import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTasks } from "./useTasks"; // your abstraction hook
import type { Task } from "./types";
import { TaskStatus } from "./const";
import { CommentResponseDto, CreateTaskDto, TaskResponseDto, InputRequestResponseDto } from "@taico/client/v2";
import { TaskActivityWireEvent } from "@taico/events";

// Animation state tracked per status (for column-based animations)
export type AnimationState = {
  enteringIds: Set<string>;
  exitingTasks: Task[];
};

// Helper to create empty animation state for all statuses
const createEmptyAnimationByStatus = (): Record<TaskStatus, AnimationState> => ({
  [TaskStatus.NOT_STARTED]: { enteringIds: new Set(), exitingTasks: [] },
  [TaskStatus.IN_PROGRESS]: { enteringIds: new Set(), exitingTasks: [] },
  [TaskStatus.FOR_REVIEW]: { enteringIds: new Set(), exitingTasks: [] },
  [TaskStatus.DONE]: { enteringIds: new Set(), exitingTasks: [] },
});

// Shape this to match what pages/layout need.
export type TasksContextValue = {
  tasks: Task[];
  createTask: (task: CreateTaskDto) => Promise<Task>;
  deleteTask: ({ taskId }: { taskId: string }) => Promise<void>;
  addComment: ({ taskId, comment }: {
    taskId: string;
    comment: string;
  }) => Promise<CommentResponseDto>;
  assignTask: ({ taskId, assigneeActorId }: {
    taskId: string;
    assigneeActorId: string;
  }) => Promise<TaskResponseDto>;
  assignTaskToMe: ({ taskId }: { taskId: string }) => Promise<TaskResponseDto>;
  answerInputRequest: ({ taskId, inputRequestId, answer }: {
    taskId: string;
    inputRequestId: string;
    answer: string;
  }) => Promise<InputRequestResponseDto>;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  error: string | null;
  isConnected: boolean;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  // Per-status animation state (for board columns)
  animationByStatus: Record<TaskStatus, AnimationState>;
  // Global animation state (for mobile "all" view)
  globalEnteringIds: Set<string>;
  globalExitingTasks: Task[];
  activityByTaskId: Record<string, TaskActivityWireEvent>;
  shippedCelebrationTrigger: number;
};

const TasksContext = createContext<TasksContextValue | null>(null);

const ANIMATION_DURATION_MS = 500;
const CELEBRATION_COOLDOWN_MS = 4000;

// Track active animations that haven't expired yet
type ActiveAnimation = {
  enteringByStatus: Record<TaskStatus, Set<string>>;
  exitingByStatus: Record<TaskStatus, Task[]>;
  globalEntering: Set<string>;
  globalExiting: Task[];
  expiresAt: number;
};

export function TasksProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: this is where the one websocket connection should be created
  const { tasks, isLoading, hasLoadedOnce, error, isConnected, createTask, deleteTask, addComment, assignTask, assignTaskToMe, answerInputRequest, activityByTaskId } = useTasks();
  const [sectionTitle, setSectionTitle] = useState("");
  const [shippedCelebrationTrigger, setShippedCelebrationTrigger] = useState(0);

  // Refs for synchronous computation
  const prevTasksRef = useRef<Map<string, Task>>(new Map());
  const activeAnimationsRef = useRef<ActiveAnimation[]>([]);
  const prevTasksForCelebrationRef = useRef<Map<string, Task>>(new Map());
  const lastCelebrationAtRef = useRef(0);

  // State to trigger cleanup re-renders
  const [cleanupTrigger, setCleanupTrigger] = useState(0);

  // Compute animation state SYNCHRONOUSLY during render (no flicker)
  const { animationByStatus, globalEnteringIds, globalExitingTasks } = useMemo(() => {
    const now = Date.now();
    const currentTasksMap = new Map(tasks.map(t => [t.id, t]));
    const prevTasks = prevTasksRef.current;
    const prevIds = new Set(prevTasks.keys());
    const currentIds = new Set(currentTasksMap.keys());

    // Remove expired animations
    activeAnimationsRef.current = activeAnimationsRef.current.filter(a => a.expiresAt > now);

    // Detect new changes (only if not initial load)
    if (prevIds.size > 0) {
      const newEnteringByStatus: Record<TaskStatus, Set<string>> = {
        [TaskStatus.NOT_STARTED]: new Set(),
        [TaskStatus.IN_PROGRESS]: new Set(),
        [TaskStatus.FOR_REVIEW]: new Set(),
        [TaskStatus.DONE]: new Set(),
      };
      const newExitingByStatus: Record<TaskStatus, Task[]> = {
        [TaskStatus.NOT_STARTED]: [],
        [TaskStatus.IN_PROGRESS]: [],
        [TaskStatus.FOR_REVIEW]: [],
        [TaskStatus.DONE]: [],
      };
      const newGlobalEntering = new Set<string>();
      const newGlobalExiting: Task[] = [];

      // Check for new/changed tasks
      for (const [id, task] of currentTasksMap) {
        const prevTask = prevTasks.get(id);
        if (!prevTask) {
          newEnteringByStatus[task.status as TaskStatus].add(id);
          newGlobalEntering.add(id);
        } else if (prevTask.status !== task.status) {
          newExitingByStatus[prevTask.status as TaskStatus].push(prevTask);
          newEnteringByStatus[task.status as TaskStatus].add(id);
        }
      }

      // Check for deleted tasks
      for (const [id, prevTask] of prevTasks) {
        if (!currentIds.has(id)) {
          newExitingByStatus[prevTask.status as TaskStatus].push(prevTask);
          newGlobalExiting.push(prevTask);
        }
      }

      // Add new animation if there are changes
      const hasChanges =
        Object.values(newEnteringByStatus).some(s => s.size > 0) ||
        Object.values(newExitingByStatus).some(a => a.length > 0);

      if (hasChanges) {
        activeAnimationsRef.current.push({
          enteringByStatus: newEnteringByStatus,
          exitingByStatus: newExitingByStatus,
          globalEntering: newGlobalEntering,
          globalExiting: newGlobalExiting,
          expiresAt: now + ANIMATION_DURATION_MS,
        });
      }
    }

    // Update prev ref for next render
    prevTasksRef.current = currentTasksMap;

    // Merge all active animations
    const mergedByStatus = createEmptyAnimationByStatus();
    let mergedGlobalEntering = new Set<string>();
    let mergedGlobalExiting: Task[] = [];

    for (const anim of activeAnimationsRef.current) {
      for (const status of Object.values(TaskStatus) as TaskStatus[]) {
        anim.enteringByStatus[status].forEach(id => mergedByStatus[status].enteringIds.add(id));
        mergedByStatus[status].exitingTasks.push(...anim.exitingByStatus[status]);
      }
      anim.globalEntering.forEach(id => mergedGlobalEntering.add(id));
      mergedGlobalExiting.push(...anim.globalExiting);
    }

    return {
      animationByStatus: mergedByStatus,
      globalEnteringIds: mergedGlobalEntering,
      globalExitingTasks: mergedGlobalExiting,
    };
  }, [tasks, cleanupTrigger]);

  // Schedule cleanup to remove expired animations
  useEffect(() => {
    if (activeAnimationsRef.current.length === 0) return;

    const nextExpiry = Math.min(...activeAnimationsRef.current.map(a => a.expiresAt));
    const delay = nextExpiry - Date.now();

    if (delay <= 0) {
      setCleanupTrigger(t => t + 1);
      return;
    }

    const timer = setTimeout(() => {
      setCleanupTrigger(t => t + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [animationByStatus, globalEnteringIds, globalExitingTasks]);

  useEffect(() => {
    const prevTasks = prevTasksForCelebrationRef.current;
    const currentTasks = new Map(tasks.map(task => [task.id, task]));

    if (prevTasks.size === 0) {
      prevTasksForCelebrationRef.current = currentTasks;
      return;
    }

    let shouldCelebrate = false;
    for (const [id, task] of currentTasks) {
      const prevTask = prevTasks.get(id);
      if (prevTask && prevTask.status !== TaskStatus.DONE && task.status === TaskStatus.DONE) {
        shouldCelebrate = true;
        break;
      }
    }

    if (shouldCelebrate) {
      const now = Date.now();
      if (now - lastCelebrationAtRef.current >= CELEBRATION_COOLDOWN_MS) {
        lastCelebrationAtRef.current = now;
        setShippedCelebrationTrigger(trigger => trigger + 1);
      }
    }

    prevTasksForCelebrationRef.current = currentTasks;
  }, [tasks]);

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<TasksContextValue>(() => {
    return {
      tasks,
      createTask,
      deleteTask,
      addComment,
      assignTask,
      assignTaskToMe,
      answerInputRequest,
      isLoading,
      hasLoadedOnce,
      error,
      isConnected,
      sectionTitle,
      setSectionTitle,
      animationByStatus,
      globalEnteringIds,
      globalExitingTasks,
      activityByTaskId,
      shippedCelebrationTrigger,
    };
  }, [
    tasks,
    createTask,
    deleteTask,
    addComment,
    assignTask,
    assignTaskToMe,
    answerInputRequest,
    isLoading,
    hasLoadedOnce,
    error,
    isConnected,
    sectionTitle,
    setSectionTitle,
    animationByStatus,
    globalEnteringIds,
    globalExitingTasks,
    activityByTaskId,
    shippedCelebrationTrigger,
  ]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasksCtx(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasksCtx must be used within <TasksProvider>");
  return ctx;
}
