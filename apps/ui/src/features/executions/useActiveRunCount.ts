import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { TaskActivityWireEvent, TaskWireEvents } from '@taico/events';
import { getUIWebSocketUrl } from '../../config/api';
import { ExecutionsService } from './api';

const POLL_INTERVAL_MS = 15000;
const SOCKET_URL = getUIWebSocketUrl('/tasks');

/**
 * Lightweight count of currently active runs, for the sidebar.
 * Fetches a single item (we only need `total`), refreshed by execution
 * events with a slow poll as fallback.
 */
export function useActiveRunCount(enabled = true): number {
  const [count, setCount] = useState(0);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await ExecutionsService.ActiveTaskExecutionController_listActiveExecutions({ limit: 1 });
      setCount(res.total);
    } catch {
      // keep last known value; this indicator is informational only
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], withCredentials: true });
    socket.on('connect', () => socket.emit('tasks.subscribe', {}, () => {}));
    socket.on(TaskWireEvents.TASK_ACTIVITY, (evt: TaskActivityWireEvent) => {
      if (evt.kind.startsWith('execution.')) void load();
    });
    return () => {
      window.clearInterval(timer);
      socket.close();
    };
  }, [enabled, load]);

  return count;
}
