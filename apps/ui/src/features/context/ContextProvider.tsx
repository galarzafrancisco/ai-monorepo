import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useContextBlocks } from "./useContextBlocks";
import type { ContextBlockSummary, ContextBlock } from "./types";

/** Tag the backend puts on the block where a thread keeps its state. */
const THREAD_STATE_TAG = "thread:state";
const HIDE_THREAD_STATE_KEY = "context.hideThreadState";

function readHideThreadState(): boolean {
  try {
    return localStorage.getItem(HIDE_THREAD_STATE_KEY) === "true";
  } catch {
    return false;
  }
}

// Shape this to match what pages/layout need.
export type ContextContextValue = {
  /** The blocks to show: without thread state blocks when they are hidden. */
  blocks: ContextBlockSummary[];
  /** How many thread state blocks exist, hidden or not. */
  threadStateBlockCount: number;
  hideThreadState: boolean;
  setHideThreadState: (hide: boolean) => void;
  getBlockById: (blockId: string) => Promise<ContextBlock | null>;
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
  const { blocks: allBlocks, getBlockById, isLoading, error, isConnected, reload } = useContextBlocks();
  const [sectionTitle, setSectionTitle] = useState("");
  const [hideThreadState, setHideThreadStateValue] = useState(readHideThreadState);

  const setHideThreadState = useCallback((hide: boolean) => {
    setHideThreadStateValue(hide);
    try {
      localStorage.setItem(HIDE_THREAD_STATE_KEY, String(hide));
    } catch {
      // The choice still applies for this visit.
    }
  }, []);

  // Threads generate one state block each; they can outnumber everything else.
  const { blocks, threadStateBlockCount } = useMemo(() => {
    const isThreadState = (block: ContextBlockSummary) =>
      block.tags.some((tag) => tag.name === THREAD_STATE_TAG);
    const count = allBlocks.filter(isThreadState).length;
    return {
      blocks: hideThreadState ? allBlocks.filter((block) => !isThreadState(block)) : allBlocks,
      threadStateBlockCount: count,
    };
  }, [allBlocks, hideThreadState]);

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ContextContextValue>(() => {
    return {
      blocks,
      threadStateBlockCount,
      hideThreadState,
      setHideThreadState,
      getBlockById,
      isLoading,
      error,
      isConnected,
      reload,
      sectionTitle,
      setSectionTitle,
    };
  }, [
    blocks,
    threadStateBlockCount,
    hideThreadState,
    setHideThreadState,
    getBlockById,
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
