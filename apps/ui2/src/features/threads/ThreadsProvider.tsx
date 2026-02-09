import React, { createContext, useContext, useMemo, useState } from "react";
import { useThreads } from "./useThreads";
import type { ThreadListItem, Thread } from "./types";

// Shape this to match what pages/layout need.
export type ThreadsContextValue = {
  threads: ThreadListItem[];
  isLoading: boolean;
  error: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  getThread: (id: string) => Promise<Thread>;
  deleteThread: (id: string) => Promise<void>;
};

const ThreadsContext = createContext<ThreadsContextValue | null>(null);

export function ThreadsProvider({ children }: { children: React.ReactNode }) {
  const { threads, isLoading, error, getThread, deleteThread } = useThreads();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ThreadsContextValue>(() => {
    return {
      threads,
      isLoading,
      error,
      sectionTitle,
      setSectionTitle,
      getThread,
      deleteThread,
    };
  }, [
    threads,
    isLoading,
    error,
    sectionTitle,
    setSectionTitle,
    getThread,
    deleteThread,
  ]);

  return <ThreadsContext.Provider value={value}>{children}</ThreadsContext.Provider>;
}

export function useThreadsCtx(): ThreadsContextValue {
  const ctx = useContext(ThreadsContext);
  if (!ctx) throw new Error("useThreadsCtx must be used within <ThreadsProvider>");
  return ctx;
}
