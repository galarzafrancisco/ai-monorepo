import { useCallback, useEffect, useState } from 'react';
import { ExecutionsService } from './api';
import type { TaskExecutionHistoryResponseDto } from './types';

export type HistoryEntryStatus = 'idle' | 'loading' | 'loaded' | 'not-found' | 'error';

type Result = {
  key: string;
  status: Exclude<HistoryEntryStatus, 'idle' | 'loading'>;
  entry: TaskExecutionHistoryResponseDto | null;
};

/**
 * One finished run, fetched by id. The runs feed only holds the latest runs,
 * so pages that link straight to a run use this when it isn't in the feed.
 * A 404 means the run doesn't exist (or hasn't finished); anything else is a
 * failure the caller can retry.
 */
export function useHistoryEntry(id: string | undefined, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = `${id}:${attempt}`;

  useEffect(() => {
    if (!enabled || !id) return;
    const controller = new AbortController();
    ExecutionsService.TaskExecutionHistoryController_getHistoryEntry({ id, signal: controller.signal })
      .then((entry) => setResult({ key, status: 'loaded', entry }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const notFound = (error as { status?: number } | null)?.status === 404;
        setResult({ key, status: notFound ? 'not-found' : 'error', entry: null });
      });
    return () => controller.abort();
  }, [enabled, id, key]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  if (!enabled || !id) return { status: 'idle' as HistoryEntryStatus, entry: null, retry };
  if (result?.key !== key) return { status: 'loading' as HistoryEntryStatus, entry: null, retry };
  return { status: result.status as HistoryEntryStatus, entry: result.entry, retry };
}
