import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ExecutionWireEvents,
  type ExecutionTracesChangedWireEvent,
} from '@taico/events';
import { ExecutionsService } from '../../executions/api';
import { getUIWebSocketUrl } from '../../../config/api';
import { mergeTraceEvents, type TraceEvent } from './traceEntries';

export function useExecutionTraces(
  executionId: string | null,
  enabled: boolean,
  onRunsChanged: () => void,
) {
  const [eventState, setEventState] = useState<{
    executionId: string | null;
    events: TraceEvent[];
    lifecycle: TraceEvent[];
  }>({ executionId: null, events: [], lifecycle: [] });
  const events =
    eventState.executionId === executionId ? eventState.events : [];
  const lifecycle =
    eventState.executionId === executionId ? eventState.lifecycle : [];
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const runsChangedRef = useRef(onRunsChanged);
  runsChangedRef.current = onRunsChanged;
  const controls = useRef<{
    refresh: () => void;
    earlier: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    setEventState({ executionId, events: [], lifecycle: [] });
    setError(null);
    setHasMoreBefore(false);
    setConnected(false);
    setIsLoading(Boolean(enabled && executionId));
    setIsLoadingEarlier(false);
    if (!enabled) return;
    const abort = new AbortController();
    let cancelled = false;
    let loaded = false;
    let syncing = false;
    let again = false;
    let reconcileAgain = false;
    let loadingEarlier = false;
    let snapshot: TraceEvent[] = [];
    const known = new Set<number>();
    let lifecycleSnapshot: TraceEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (incoming: TraceEvent[], lifecycle: TraceEvent[]) => {
      const mergedLifecycle = mergeTraceEvents(
        lifecycleSnapshot,
        lifecycle ?? [],
      );
      const lifecycleChanged =
        mergedLifecycle.length !== lifecycleSnapshot.length;
      lifecycleSnapshot = mergedLifecycle;
      const added = incoming.filter((event) => !known.has(event.sequence));
      if (!added.length && !lifecycleChanged) return;
      for (const event of added) known.add(event.sequence);
      snapshot = mergeTraceEvents(snapshot, added);
      if (!cancelled)
        setEventState({
          executionId,
          events: snapshot,
          lifecycle: lifecycleSnapshot,
        });
    };
    const refresh = async (reconcile = false) => {
      if (!executionId || cancelled) return;
      if (syncing) {
        again = true;
        reconcileAgain ||= reconcile;
        return;
      }
      syncing = true;
      try {
        if (!loaded) {
          const page = await ExecutionsService.ExecutionTracesController_list({
            executionId,
            latest: true,
            limit: 100,
            signal: abort.signal,
          });
          if (cancelled) return;
          apply(page.items, page.lifecycle);
          setHasMoreBefore(page.hasMoreBefore);
          loaded = true;
        } else {
          let more = true;
          while (more && !cancelled) {
            const afterSequence = snapshot.at(-1)?.sequence ?? 0;
            const page = await ExecutionsService.ExecutionTracesController_list(
              { executionId, afterSequence, limit: 100, signal: abort.signal },
            );
            if (cancelled) return;
            apply(page.items, page.lifecycle);
            more = page.items.length === 100;
          }
          if (reconcile && !cancelled) {
            // A reconnecting worker may backfill an event below our cursor.
            // Reconcile the recent window as well as fetching new sequences.
            const latest =
              await ExecutionsService.ExecutionTracesController_list({
                executionId,
                latest: true,
                limit: 100,
                signal: abort.signal,
              });
            if (cancelled) return;
            apply(latest.items, latest.lifecycle);
            if (snapshot[0]?.sequence === latest.items[0]?.sequence)
              setHasMoreBefore(latest.hasMoreBefore);
          }
        }
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load execution traces.',
          );
      } finally {
        syncing = false;
        if (!cancelled) {
          setIsLoading(false);
          if (again) {
            again = false;
            const reconcileNext = reconcileAgain;
            reconcileAgain = false;
            void refresh(reconcileNext);
          }
        }
      }
    };
    const scheduleRefresh = () => {
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined;
          void refresh(true);
        }, 150);
    };
    controls.current = {
      refresh: () => void refresh(true),
      earlier: async () => {
        if (!executionId || !snapshot.length || loadingEarlier) return;
        loadingEarlier = true;
        setIsLoadingEarlier(true);
        try {
          const page = await ExecutionsService.ExecutionTracesController_list({
            executionId,
            beforeSequence: snapshot[0].sequence,
            limit: 100,
            signal: abort.signal,
          });
          if (!cancelled) {
            apply(page.items, page.lifecycle);
            setHasMoreBefore(page.hasMoreBefore);
            setError(null);
          }
        } catch (err) {
          if (!cancelled)
            setError(
              err instanceof Error
                ? err.message
                : 'Could not load earlier events.',
            );
        } finally {
          loadingEarlier = false;
          if (!cancelled) setIsLoadingEarlier(false);
        }
      },
    };
    const socket = io(getUIWebSocketUrl('/executions'), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socket.on('connect', () => {
      socket.emit('executions.subscribe', {}, (ack: { ok?: boolean }) => {
        if (!cancelled && ack?.ok) runsChangedRef.current();
      });
      if (executionId)
        socket.emit(
          'execution.traces.subscribe',
          { executionId },
          (ack: { ok?: boolean }) => {
            if (!cancelled && ack?.ok) {
              setConnected(true);
              void refresh(true);
            }
          },
        );
    });
    socket.on('disconnect', () => {
      if (!cancelled) setConnected(false);
    });
    socket.on('connect_error', () => {
      if (!cancelled) setConnected(false);
    });
    socket.on(ExecutionWireEvents.EXECUTIONS_CHANGED, () =>
      runsChangedRef.current(),
    );
    socket.on(
      ExecutionWireEvents.EXECUTION_TRACES_CHANGED,
      (event: ExecutionTracesChangedWireEvent) => {
        if (event.executionId === executionId) scheduleRefresh();
      },
    );
    void refresh(true);
    // Reconcile after a missed notification, reconnect, or late worker upload.
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh(true);
        runsChangedRef.current();
      }
    }, 10_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh(true);
        runsChangedRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      abort.abort();
      clearInterval(poll);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      socket.close();
      controls.current = null;
    };
  }, [executionId, enabled]);

  const refresh = useCallback(() => controls.current?.refresh(), []);
  const loadEarlier = useCallback(async () => {
    await controls.current?.earlier();
  }, []);
  return {
    events,
    lifecycle,
    isLoading,
    isLoadingEarlier,
    hasMoreBefore,
    error,
    connected,
    refresh,
    loadEarlier,
  };
}
