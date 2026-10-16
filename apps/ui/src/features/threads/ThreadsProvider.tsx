import React, { createContext, useContext, useMemo, useState } from "react";
import { useThreads } from "./useThreads";
import { useTabUnreadIndicator } from "./useTabUnreadIndicator";
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
  /** How many threads exist, including the ones not loaded yet. */
  totalThreads: number;
  /** True while there are older threads the list has not loaded. */
  hasMoreThreads: boolean;
  /** True while the next page of older threads is being fetched. */
  isLoadingMore: boolean;
  loadMoreError: string | null;
  /** Loads the next page of older threads. */
  loadMoreThreads: () => Promise<void>;
  /** Fetches the list again in the background, without the loading state. */
  refreshThreads: () => Promise<void>;
  /** How many threads have at least one unread message. */
  unreadThreadCount: number;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  navItems: NavegationItem[];
  setNavItems: (navItems: NavegationItem[]) => void;
  getThread: (id: string) => Promise<Thread>;
  createThread: (title?: string) => Promise<Thread>;
  deleteThread: (id: string) => Promise<void>;
  /** Marks every message in the thread as read by the current user. */
  markThreadRead: (id: string) => Promise<void>;
  /** Pins the thread to the top of the current user's list, or unpins it. */
  setThreadPinned: (id: string, pinned: boolean) => Promise<void>;
  /** Tells the list which thread the user is looking at, or null for none. */
  setViewingThreadId: (id: string | null) => void;
  optimisticDraftThread: OptimisticThreadDraft | null;
  setOptimisticDraftThread: (draft: OptimisticThreadDraft | null) => void;
};

const ThreadsContext = createContext<ThreadsContextValue | null>(null);

/**
 * Holds the thread list and its unread counts for the whole app.
 *
 * Mounted once around the shell, not per section: the main navigation shows
 * an unread badge on every page, and a tab has to hear `thread.read` and
 * `thread.activity` whichever page it is on.
 */
export function ThreadsProvider({ children }: { children: React.ReactNode }) {
  const { threads, totalThreads, hasMoreThreads, isLoadingMore, loadMoreError, loadMoreThreads, isLoading, error, loadThreads, refreshThreads, getThread, createThread, deleteThread, markThreadRead, setThreadPinned, setViewingThreadId } = useThreads();
  const [sectionTitle, setSectionTitle] = useState("");
  const [navItems, setNavItems] = useState<NavegationItem[]>([]);
  const [optimisticDraftThread, setOptimisticDraftThread] = useState<OptimisticThreadDraft | null>(null);

  const unreadThreadCount = useMemo(
    () => threads.filter((thread) => thread.unreadCount > 0).length,
    [threads],
  );
  useTabUnreadIndicator(unreadThreadCount);

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ThreadsContextValue>(() => {
    return {
      threads,
      isLoading,
      error,
      loadThreads,
      totalThreads,
      hasMoreThreads,
      isLoadingMore,
      loadMoreError,
      loadMoreThreads,
      refreshThreads,
      unreadThreadCount,
      sectionTitle,
      setSectionTitle,
      navItems,
      setNavItems,
      getThread,
      createThread,
      deleteThread,
      markThreadRead,
      setThreadPinned,
      setViewingThreadId,
      optimisticDraftThread,
      setOptimisticDraftThread,
    };
  }, [
    threads,
    isLoading,
    error,
    loadThreads,
    totalThreads,
    hasMoreThreads,
    isLoadingMore,
    loadMoreError,
    loadMoreThreads,
    refreshThreads,
    unreadThreadCount,
    sectionTitle,
    setSectionTitle,
    navItems,
    setNavItems,
    getThread,
    createThread,
    deleteThread,
    markThreadRead,
    setThreadPinned,
    setViewingThreadId,
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
