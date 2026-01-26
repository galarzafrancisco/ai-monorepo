import { useEffect, useState } from 'react';
import { ThreadsService } from './api';
import type { Thread } from './types';

export const useThreads = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [threads, setThreads] = useState<Thread[]>([]);

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

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    threads,
    loadThreads,
  };
};
