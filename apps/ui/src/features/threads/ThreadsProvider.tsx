import React, { createContext, useContext, useMemo, useState } from "react";
import { useThreads } from "./useThreads";
import type { ThreadListItem, Thread } from "./types";
import { NavegationItem } from "src/shared/types/NavegationItem";

export type OptimisticThreadDraft = {
  title: string;
  message: string;
};

// Shape this to match what pages/layout need.
export type ThreadsContextValue = {
  threads: ThreadListItem[];
  isLoading: boolean;
  error: string | null;
  loadThreads: () => Promise<void>;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  navItems: NavegationItem[];
  setNavItems: (navItems: NavegationItem[]) => void;
  getThread: (id: string) => Promise<Thread>;
  createThread: (title?: string) => Promise<Thread>;
  deleteThread: (id: string) => Promise<void>;
  optimisticDraftThread: OptimisticThreadDraft | null;
  setOptimisticDraftThread: (draft: OptimisticThreadDraft | null) => void;
};

const ThreadsContext = createContext<ThreadsContextValue | null>(null);

export function ThreadsProvider({ children }: { children: React.ReactNode }) {
  const { threads, isLoading, error, loadThreads, getThread, createThread, deleteThread } = useThreads();
  const [sectionTitle, setSectionTitle] = useState("");
  const [navItems, setNavItems] = useState<NavegationItem[]>([]);
  const [optimisticDraftThread, setOptimisticDraftThread] = useState<OptimisticThreadDraft | null>(null);

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ThreadsContextValue>(() => {
    return {
      threads,
      isLoading,
      error,
      loadThreads,
      sectionTitle,
      setSectionTitle,
      navItems,
      setNavItems,
      getThread,
      createThread,
      deleteThread,
      optimisticDraftThread,
      setOptimisticDraftThread,
    };
  }, [
    threads,
    isLoading,
    error,
    loadThreads,
    sectionTitle,
    setSectionTitle,
    navItems,
    setNavItems,
    getThread,
    createThread,
    deleteThread,
    optimisticDraftThread,
    setOptimisticDraftThread,
  ]);

  return <ThreadsContext.Provider value={value}>{children}</ThreadsContext.Provider>;
}

export function useThreadsCtx(): ThreadsContextValue {
  const ctx = useContext(ThreadsContext);
  if (!ctx) throw new Error("useThreadsCtx must be used within <ThreadsProvider>");
  return ctx;
}
