import { useEffect, useState, useCallback } from 'react';
import { ThreadsService } from './api';
import type { ThreadListItem, Thread } from './types';

export const useThreads = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [threads, setThreads] = useState<ThreadListItem[]>([]);

  // Boot
  useEffect(() => {
    loadThreads();
  }, []);

  // Load threads
  const loadThreads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ThreadsService.listThreads();
      setThreads(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    } finally {
      setIsLoading(false);
    }
  };

  // Get single thread with full details
  const getThread = useCallback(async (id: string): Promise<Thread> => {
    return await ThreadsService.getThread(id);
  }, []);

  const deleteThread = useCallback(async (id: string) => {
    await ThreadsService.deleteThread(id);
    setThreads((prev) => prev.filter((thread) => thread.id !== id));
  }, []);

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    threads,
    loadThreads,
    getThread,
    deleteThread,
  };
};
