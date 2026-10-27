import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Avatar, Button, Chip } from '../../../ui/primitives';
import { elapsedTime } from '../../../shared/helpers/elapsedTime';
import { isDeactivated, useActorsCtx } from '../../actors';
import { isRunPotentiallyStale, POTENTIALLY_STALE_MESSAGE, runStatusTag, type TaskRun } from './runs';
import './RunList.css';

const COLLAPSED_COUNT = 3;

/**
 * A task's runs, newest first. Each row is one run: who ran it, how it ended,
 * and (when it failed) why. Selecting a row shows that run's trace.
 */
export function RunList({
  runs,
  selectedExecutionId,
  onSelect,
  onInterrupt,
  interruptingExecutionIds,
  isLoading,
  error,
}: {
  runs: TaskRun[];
  /** Highlights the run whose trace is showing; omit where rows open a page instead. */
  selectedExecutionId?: string | null;
  onSelect: (run: TaskRun) => void;
  onInterrupt: (run: TaskRun) => void;
  interruptingExecutionIds: Set<string>;
  isLoading: boolean;
  error: string | null;
}) {
  const { actors } = useActorsCtx();
  const [showAll, setShowAll] = useState(false);
  const now = useStalenessClock(runs.some((run) => run.source === 'active'));

  if (isLoading && runs.length === 0) {
    return <p className="run-list__state">Loading runs…</p>;
  }
  if (error) {
    return <p className="run-list__state">Couldn't load runs: {error}</p>;
  }
  if (runs.length === 0) {
    return <p className="run-list__state">No runs yet. When an agent picks this task up, its run shows here.</p>;
  }

  // Keep the selected run visible even when it's older than the collapsed few.
  const selectedIndex = runs.findIndex((run) => run.executionId === selectedExecutionId);
  const collapsedCount = Math.max(COLLAPSED_COUNT, selectedIndex + 1);
  const visible = showAll ? runs : runs.slice(0, collapsedCount);

  return (
    <div className="run-list">
      <ul className="run-list__items">
        {visible.map((run) => {
          const actor = actors.find((candidate) => candidate.id === run.agentActorId);
          const name = actor?.displayName ?? 'Agent';
          const tag = runStatusTag(run);
          const isSelected = run.executionId === selectedExecutionId;
          const isActive = run.source === 'active';
          const isStale = isRunPotentiallyStale(run, now);
          const isInterrupting = interruptingExecutionIds.has(run.executionId);
          const failure = run.status === 'FAILED' ? run.errorMessage ?? run.errorCode : null;

          return (
            <li key={run.id} className={`run-list__item${isSelected ? ' run-list__item--selected' : ''}`}>
              <button
                type="button"
                className="run-list__row"
                onClick={() => onSelect(run)}
                aria-current={isSelected || undefined}
                aria-label={`${name}, ${tag.label}, ${elapsedTime(run.timestamp)}. Show trace`}
              >
                <Avatar size="sm" name={name} inactive={isDeactivated(actor)} src={actor?.avatarUrl || undefined} />
                <span className="run-list__main">
                  <span className="run-list__line">
                    <span className="run-list__name">{name}</span>
                    <Chip color={tag.color}>{isActive && <span className="run-list__live-dot" />}{tag.label}</Chip>
                    {isStale && <span title={POTENTIALLY_STALE_MESSAGE}><Chip color="orange">potentially stale</Chip></span>}
                  </span>
                  <span className="run-list__meta">
                    {isActive ? `started ${elapsedTime(run.timestamp)}` : elapsedTime(run.timestamp)}
                    {' · '}
                    {run.toolCallCount === 1 ? '1 tool call' : `${run.toolCallCount} tool calls`}
                    {' · '}
                    <span className="run-list__id">#{run.executionId.slice(0, 6)}</span>
                  </span>
                  {failure && <span className="run-list__failure">{failure}</span>}
                </span>
                <ChevronRight className="run-list__chevron" size={16} aria-hidden="true" />
              </button>
              {isActive && (
                <Button
                  variant="danger"
                  size="sm"
                  className="run-list__interrupt"
                  disabled={isInterrupting}
                  onClick={() => onInterrupt(run)}
                >
                  {isInterrupting ? 'Interrupting…' : 'Interrupt'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {runs.length > collapsedCount && (
        <button type="button" className="run-list__more" onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Show fewer runs' : `Show ${runs.length - collapsedCount} older ${runs.length - collapsedCount === 1 ? 'run' : 'runs'}`}
        </button>
      )}
    </div>
  );
}

/** Ticks every 30s while a run is live, so "potentially stale" appears without a reload. */
function useStalenessClock(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}
