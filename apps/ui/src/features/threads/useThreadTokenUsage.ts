import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThreadTokenUsageResponseDto } from '@taico/client/v2';
import { ThreadsService } from './api';

/**
 * Token figures for a thread, for the debug indicator in the thread header.
 * Stays null until loaded and when the request fails: the indicator is not
 * worth an error on screen.
 */
export const useThreadTokenUsage = (threadId: string | undefined) => {
  const [usage, setUsage] = useState<ThreadTokenUsageResponseDto | null>(null);
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!threadId) return;
    const request = ++latestRequestRef.current;
    try {
      const result = await ThreadsService.ThreadsController_getThreadTokenUsage({ id: threadId });
      // A slower, older answer must not replace a newer one.
      if (request === latestRequestRef.current) setUsage(result);
    } catch {
      if (request === latestRequestRef.current) setUsage(null);
    }
  }, [threadId]);

  useEffect(() => {
    setUsage(null);
    void refresh();
  }, [refresh]);

  return { usage, refresh };
};
