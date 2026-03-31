import React, { createContext, useContext, useMemo, useState } from "react";
import { useExecutions } from "./useExecutions";
import type { Execution } from "./types";

export type ExecutionsContextValue = {
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  executions: Execution[];
  isLoading: boolean;
  hasLoadedOnce: boolean;
  error: string | null;
  isConnected: boolean;
  loadExecutions: () => Promise<void>;
};

const ExecutionsContext = createContext<ExecutionsContextValue | null>(null);

export function ExecutionsProvider({ children }: { children: React.ReactNode }) {
  const [sectionTitle, setSectionTitle] = useState("Work Queue");
  const {
    executions,
    isLoading,
    hasLoadedOnce,
    error,
    isConnected,
    loadExecutions,
  } = useExecutions();

  const value = useMemo<ExecutionsContextValue>(() => {
    return {
      sectionTitle,
      setSectionTitle,
      executions,
      isLoading,
      hasLoadedOnce,
      error,
      isConnected,
      loadExecutions,
    };
  }, [sectionTitle, executions, isLoading, hasLoadedOnce, error, isConnected, loadExecutions]);

  return <ExecutionsContext.Provider value={value}>{children}</ExecutionsContext.Provider>;
}

export function useExecutionsCtx(): ExecutionsContextValue {
  const ctx = useContext(ExecutionsContext);
  if (!ctx) throw new Error("useExecutionsCtx must be used within <ExecutionsProvider>");
  return ctx;
}
