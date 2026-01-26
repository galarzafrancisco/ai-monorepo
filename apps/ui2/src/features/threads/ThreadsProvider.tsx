import React, { createContext, useContext, useMemo, useState } from "react";
import { useThreads } from "./useThreads";
import type { Thread } from "./types";

// Shape this to match what pages/layout need.
export type ThreadsContextValue = {
  threads: Thread[];
  isLoading: boolean;
  error: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
};

const ThreadsContext = createContext<ThreadsContextValue | null>(null);

export function ThreadsProvider({ children }: { children: React.ReactNode }) {
  const { threads, isLoading, error } = useThreads();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ThreadsContextValue>(() => {
    return {
      threads,
      isLoading,
      error,
      sectionTitle,
      setSectionTitle,
    };
  }, [
    threads,
    isLoading,
    error,
    sectionTitle,
    setSectionTitle,
  ]);

  return <ThreadsContext.Provider value={value}>{children}</ThreadsContext.Provider>;
}

export function useThreadsCtx(): ThreadsContextValue {
  const ctx = useContext(ThreadsContext);
  if (!ctx) throw new Error("useThreadsCtx must be used within <ThreadsProvider>");
  return ctx;
}
