import React, { createContext, useContext, useMemo, useState } from "react";
import { useContextBlocks } from "./useContextBlocks";
import type { ContextBlockSummary } from "./types";

// Shape this to match what pages/layout need.
export type ContextContextValue = {
  blocks: ContextBlockSummary[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  reload: () => Promise<void>;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
};

const ContextContext = createContext<ContextContextValue | null>(null);

export function ContextProvider({ children }: { children: React.ReactNode }) {
  // WebSocket connection for real-time updates
  const { blocks, isLoading, error, isConnected, reload } = useContextBlocks();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ContextContextValue>(() => {
    return {
      blocks,
      isLoading,
      error,
      isConnected,
      reload,
      sectionTitle,
      setSectionTitle,
    };
  }, [
    blocks,
    isLoading,
    error,
    isConnected,
    reload,
    sectionTitle,
    setSectionTitle,
  ]);

  return <ContextContext.Provider value={value}>{children}</ContextContext.Provider>;
}

export function useContextCtx(): ContextContextValue {
  const ctx = useContext(ContextContext);
  if (!ctx) throw new Error("useContextCtx must be used within <ContextProvider>");
  return ctx;
}
