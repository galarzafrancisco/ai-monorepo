import { useCallback, useEffect, useRef, useState } from 'react';
import { ExecutionsService } from './api';
import type {
  ActiveTaskExecutionResponseDto,
  TaskExecutionHistoryResponseDto,
  TaskExecutionQueueEntryResponseDto,
} from './types';

const EXECUTIONS_POLL_INTERVAL_MS = 5000;

export const useExecutions = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [queue, setQueue] = useState<TaskExecutionQueueEntryResponseDto[]>([]);
  const [active, setActive] = useState<ActiveTaskExecutionResponseDto[]>([]);
  const [history, setHistory] = useState<TaskExecutionHistoryResponseDto[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const loadExecutions = useCallback(async (options?: { silent?: boolean }) => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;

    const firstLoad = !hasLoadedOnce;
    const silent = options?.silent ?? false;

    if (firstLoad) {
      setIsLoading(true);
    } else if (!silent) {
      setIsRefreshing(true);
    }

    try {
      const [nextQueue, nextActive, nextHistory] = await Promise.all([
        ExecutionsService.TaskExecutionQueueController_listQueue(),
        ExecutionsService.ActiveTaskExecutionController_listActiveExecutions(),
        ExecutionsService.TaskExecutionHistoryController_listHistory(),
      ]);

      setQueue(nextQueue);
      setActive(nextActive);
      setHistory(nextHistory);
      setLastUpdatedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load executions'
      );
    } finally {
      inFlightRef.current = false;
      setHasLoadedOnce(true);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [hasLoadedOnce]);

  useEffect(() => {
    void loadExecutions();

    const timer = window.setInterval(() => {
      void loadExecutions({ silent: true });
    }, EXECUTIONS_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadExecutions]);

  return {
    isLoading,
    isRefreshing,
    hasLoadedOnce,
    error,
    queue,
    active,
    history,
    loadExecutions,
    lastUpdatedAt,
  };
};
