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
import { buildTraceEntries, type TraceEntry } from './traceEntries';
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
}: {
  run: TraceRun | null;
  onRunsChanged: () => void;
  isLoadingRuns?: boolean;
  runsError?: string | null;
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
  const earlierAnchor = useRef<{ sequence: number; top: number } | null>(null);
  const [pausedExecutionId, setPausedExecutionId] = useState<string | null>(
    null,
  );
  const following = pausedExecutionId !== run?.executionId;
  const setFollowing = (value: boolean) =>
    setPausedExecutionId(value ? null : (run?.executionId ?? null));
  const visible = entries.filter((entry) => entry.kind !== 'system');

  useLayoutEffect(() => {
    earlierAnchor.current = null;
  }, [run?.executionId]);
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (earlierAnchor.current) {
      const anchor = earlierAnchor.current;
      const anchored = entries.find((entry) =>
        entry.events.some((event) => event.sequence === anchor.sequence),
      );
      const entry = anchored
        ? scroll.querySelector<HTMLElement>(
            `[data-trace-entry="${CSS.escape(anchored.id)}"]`,
          )
        : null;
      if (entry) {
        scroll.scrollTop += entry.getBoundingClientRect().top - anchor.top;
      }
      if (!isLoadingEarlier) earlierAnchor.current = null;
    } else if (following) scroll.scrollTop = scroll.scrollHeight;
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
      {run && (
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
        {hasMoreBefore && (
          <Button
            variant="ghost"
            size="sm"
            className="task-traces__earlier"
            disabled={isLoadingEarlier}
            onClick={async () => {
              setFollowing(false);
              const scroll = scrollRef.current;
              const top = scroll?.getBoundingClientRect().top ?? 0;
              const entry = [
                ...(scroll?.querySelectorAll<HTMLElement>(
                  '[data-trace-sequence]',
                ) ?? []),
              ].find((element) => element.getBoundingClientRect().bottom > top);
              earlierAnchor.current = entry
                ? {
                    sequence: Number(entry.dataset.traceSequence),
                    top: entry.getBoundingClientRect().top,
                  }
                : null;
              await loadEarlier();
            }}
          >
            {isLoadingEarlier ? 'Loading…' : 'Load earlier events'}
          </Button>
        )}
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
              {visible.map((entry) => (
                <TraceEntryView
                  key={`${run?.executionId}:${entry.id}`}
                  entry={entry}
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
            <div className="task-traces__end">
              <span
                className={run?.source === 'active' ? 'task-traces__dot' : ''}
              />
              {run?.source === 'active'
                ? 'Waiting for activity'
                : 'End of execution'}
            </div>
          </>
        )}
      </div>
      <footer className="task-traces__footer">
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
      </footer>
    </div>
  );
}

function TraceEntryView({ entry }: { entry: TraceEntry }) {
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
  const raw = <RawTraceDetails entry={entry} />;
  return (
    <article
      className={`task-traces__entry task-traces__entry--${entry.kind}`}
      data-trace-sequence={entry.events[0].sequence}
      data-trace-entry={entry.id}
    >
      <div className="task-traces__marker">
        <Icon size={14} />
      </div>
      <div className="task-traces__entry-content">
        <div className="task-traces__entry-meta">
          <span>{entry.kind === 'tool' ? 'Tool' : entry.title}</span>
          <time dateTime={entry.events[0].emittedAt}>
            {time(entry.events[0].emittedAt)}
          </time>
        </div>
        {entry.kind === 'tool' ? (
          <details className="task-traces__tool">
            <summary>
              <ChevronRight size={13} />
              <strong>{entry.title}</strong>
              {entry.status && (
                <span
                  className={
                    entry.status.toLowerCase() === 'failed'
                      ? 'task-traces__failed'
                      : ''
                  }
                >
                  {entry.status}
                </span>
              )}
            </summary>
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
          </details>
        ) : (
          <>
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
          </>
        )}
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
