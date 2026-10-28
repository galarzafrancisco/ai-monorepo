import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Braces,
  ChevronRight,
  CircleAlert,
  MessageSquare,
  Radio,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { Button, Text } from '../../../ui/primitives';
import { LoadEarlier, useLoadEarlier } from '../../../ui/components';
import { buildTraceEntries, splitToolName, summarizeToolInput, type TraceEntry } from './traceEntries';
import { useExecutionTraces } from './useExecutionTraces';
import { ExecutionSteps } from './ExecutionSteps';
import type { TraceRun } from './runs';
import './TaskTracesPanel.css';

const time = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/**
 * One run's trace: its progress steps, then messages and tool activity, live
 * while the run is active. Used by the task's Runs panel and the full-page
 * trace view (/runs/:kind/:id/traces).
 */
export function RunTrace({
  run,
  onRunsChanged,
  isLoadingRuns = false,
  runsError = null,
  compact = false,
}: {
  run: TraceRun | null;
  onRunsChanged: () => void;
  isLoadingRuns?: boolean;
  runsError?: string | null;
  /** Side-panel use: drops the connection toolbar, and the footer while following. */
  compact?: boolean;
}) {
  const {
    events,
    lifecycle,
    isLoading,
    isLoadingEarlier,
    hasMoreBefore,
    error,
    connected,
    refresh,
    loadEarlier,
  } = useExecutionTraces(run?.executionId ?? null, true, onRunsChanged);
  const entries = useMemo(() => buildTraceEntries(events), [events]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pausedExecutionId, setPausedExecutionId] = useState<string | null>(
    null,
  );
  const following = pausedExecutionId !== run?.executionId;
  const setFollowing = (value: boolean) =>
    setPausedExecutionId(value ? null : (run?.executionId ?? null));
  const visible = entries.filter((entry) => entry.kind !== 'system');

  const isLive = run?.source === 'active';

  // Scrolling up loads earlier events, keeping the ones on screen where they are.
  const { sentinelRef: earlierSentinelRef, loadEarlier: loadEarlierEvents } = useLoadEarlier({
    containerRef: scrollRef,
    hasMore: hasMoreBefore,
    isLoading: isLoadingEarlier,
    load: () => {
      setFollowing(false);
      return loadEarlier();
    },
    itemSelector: '[data-trace-entry]',
    contentDeps: [events],
  });

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (scroll && following && !isLoadingEarlier) scroll.scrollTop = scroll.scrollHeight;
  }, [events, entries, following, isLoadingEarlier]);

  return (
    <div className="run-trace">
      {run && (
        <ExecutionSteps
          events={lifecycle}
          terminal={run.source === 'history'}
          stale={run.status === 'STALE'}
          loading={isLoading}
        />
      )}
      {run && !compact && (
        <div className="task-traces__toolbar">
          <span className="task-traces__connection">
            <Radio size={12} />
            {connected ? 'Live updates' : 'Reconnecting · checking for updates'}
          </span>
          <span>{events.length} events loaded</span>
        </div>
      )}
      {(error || runsError) && (
        <div className="task-traces__error" role="alert">
          <CircleAlert size={16} />
          <span>{error || runsError}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              refresh();
              onRunsChanged();
            }}
          >
            Retry
          </Button>
        </div>
      )}
      <div
        className="task-traces__scroll"
        ref={scrollRef}
        tabIndex={0}
        aria-label="Execution events"
        onScroll={(event) => {
          const el = event.currentTarget;
          setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 64);
        }}
      >
        <LoadEarlier
          sentinelRef={earlierSentinelRef}
          hasMore={hasMoreBefore}
          isLoading={isLoadingEarlier}
          onLoad={loadEarlierEvents}
          noun="events"
        />
        {isLoading || (isLoadingRuns && !run) ? (
          <div className="task-traces__empty" role="status">
            <Terminal size={28} />
            <Text>Loading execution traces…</Text>
          </div>
        ) : !events.length ? (
          <div className="task-traces__empty">
            <Terminal size={30} />
            <Text weight="medium">
              {!run
                ? 'A window into the work'
                : run.source === 'active'
                  ? 'Waiting for the first event'
                  : 'No traces for this run'}
            </Text>
            <Text size="2" tone="muted">
              {!run
                ? 'When an agent runs this task, its messages and tool activity will appear here.'
                : run.source === 'active'
                  ? 'Messages and tool activity will arrive here as the agent works.'
                  : 'This execution may have run before trace capture was enabled.'}
            </Text>
          </div>
        ) : (
          <>
            <div className="task-traces__timeline">
              {visible.map((entry, index) => (
                <TraceEntryView
                  key={`${run?.executionId}:${entry.id}`}
                  entry={entry}
                  live={isLive && index === visible.length - 1}
                />
              ))}
            </div>
            {!visible.length && (
              <p className="task-traces__activity-hint">
                {run?.source === 'active'
                  ? 'Waiting for messages or tool activity.'
                  : 'No messages or tool activity in this run.'}
              </p>
            )}
            {isLive ? (
              visible.length > 0 && !isEntryWorking(visible[visible.length - 1]) && (
                <div className="task-traces__working" role="status">
                  <span className="shimmer-text">Working…</span>
                </div>
              )
            ) : (
              <div className="task-traces__end">End of execution</div>
            )}
          </>
        )}
      </div>
      {(!compact || (events.length > 0 && !following)) && <footer className="task-traces__footer">
        <span>
          {events.length
            ? `Last event ${time(events[events.length - 1].emittedAt)}`
            : 'Traces are saved with each execution'}
        </span>
        {events.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFollowing(true);
              if (scrollRef.current)
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }}
          >
            <ArrowDown size={13} />
            {following ? 'Following' : 'Jump to latest'}
          </Button>
        )}
      </footer>}
    </div>
  );
}

/** A tool still running, or the agent thinking: what the live shimmer marks. */
export function isEntryWorking(entry: TraceEntry): boolean {
  if (entry.kind === 'thinking') return true;
  if (entry.kind !== 'tool') return false;
  const status = entry.status?.toLowerCase();
  return status !== 'completed' && status !== 'failed' && status !== 'error';
}

export function TraceEntryView({ entry, live = false }: { entry: TraceEntry; live?: boolean }) {
  const Icon =
    entry.kind === 'tool'
      ? Terminal
      : entry.kind === 'thinking'
        ? Sparkles
        : entry.kind === 'error'
          ? CircleAlert
          : entry.kind === 'message'
            ? MessageSquare
            : Braces;
  const working = live && isEntryWorking(entry);
  const raw = entry.events.length ? <RawTraceDetails entry={entry} /> : null;
  const emittedAt = entry.events[0]?.emittedAt ?? entry.timestamp;
  const at = (
    <time dateTime={emittedAt}>
      {emittedAt ? time(emittedAt) : ''}
    </time>
  );

  if (entry.kind === 'tool') {
    const failed = ['failed', 'error'].includes(entry.status?.toLowerCase() ?? '');
    const hint = summarizeToolInput(entry.input);
    const name = splitToolName(entry.title);
    return (
      <article
        className={`task-traces__entry task-traces__entry--tool${working ? ' task-traces__entry--working' : ''}${failed ? ' task-traces__entry--failed' : ''}`}
        data-trace-entry={entry.id}
      >
        <div className="task-traces__marker">
          <Icon size={14} />
        </div>
        <details className="task-traces__call">
          <summary>
            <span className="task-traces__tool-name" title={entry.title}>
              {name.server && <span className="task-traces__tool-server">{name.server}</span>}
              <strong className={working ? 'shimmer-text' : undefined}>{name.tool}</strong>
            </span>
            {hint && <span className="task-traces__hint" title={hint}>{hint}</span>}
            {failed && <span className="task-traces__failed">failed</span>}
            {at}
            <ChevronRight className="task-traces__chevron" size={13} aria-hidden="true" />
          </summary>
          <div className="task-traces__call-body">
            {entry.input && (
              <>
                <div className="task-traces__label">Input</div>
                <pre>{entry.input}</pre>
              </>
            )}
            {entry.text && (
              <>
                <div className="task-traces__label">Output</div>
                <pre>{entry.text}</pre>
              </>
            )}
            {raw}
          </div>
        </details>
      </article>
    );
  }

  return (
    <article
      className={`task-traces__entry task-traces__entry--${entry.kind}${working ? ' task-traces__entry--working' : ''}`}
      data-trace-entry={entry.id}
    >
      <div className="task-traces__marker">
        <Icon size={14} />
      </div>
      <div className="task-traces__entry-content">
        <div className="task-traces__entry-meta">
          <span className={working ? 'shimmer-text' : undefined}>{entry.title}</span>
          {at}
        </div>
        {entry.text &&
          (entry.text.length > 1600 ? (
            <details className="task-traces__long">
              <summary>
                {entry.text.slice(0, 360)}… <span>Show more</span>
              </summary>
              <div className="task-traces__text">{entry.text}</div>
            </details>
          ) : (
            <div className="task-traces__text">{entry.text}</div>
          ))}
        {raw}
      </div>
    </article>
  );
}

function RawTraceDetails({ entry }: { entry: TraceEntry }) {
  const [open, setOpen] = useState(false);
  const json = useMemo(
    () =>
      open
        ? JSON.stringify(
            entry.events.map((event) => event.payload),
            null,
            2,
          )
        : '',
    [open, entry.events],
  );
  return (
    <details
      className="task-traces__raw"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <Braces size={12} />
        Raw{' '}
        {entry.events.length === 1
          ? 'event'
          : `events (${entry.events.length})`}
      </summary>
      {open && <pre>{json}</pre>}
    </details>
  );
}
