import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Maximize2, Minimize2, PanelRightClose, Terminal } from 'lucide-react';
import { Button, Text } from '../../../ui/primitives';
import { RunList } from './RunList';
import { RunTrace } from './RunTrace';
import { runTracePath, type TaskRun } from './runs';
import './TaskTracesPanel.css';

export type RunsPanelMode = 'closed' | 'third' | 'full';

/**
 * Desktop side bar: the task's runs, and the trace of the selected one (the
 * live run by default, otherwise the latest). It sits collapsed as a rail,
 * opens to a third of the page, or takes the whole page.
 */
export function TaskRunsPanel({
  runs,
  isLoadingRuns,
  runsError,
  onRefreshRuns,
  mode,
  onModeChange,
  onInterrupt,
  interruptingExecutionIds,
}: {
  runs: TaskRun[];
  isLoadingRuns: boolean;
  runsError: string | null;
  onRefreshRuns: () => void;
  mode: RunsPanelMode;
  onModeChange: (mode: RunsPanelMode) => void;
  onInterrupt: (run: TaskRun) => void;
  interruptingExecutionIds: Set<string>;
}) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const run =
    runs.find((item) => item.executionId === chosenId) ??
    runs.find((item) => item.source === 'active') ??
    runs[0] ??
    null;
  const hasLiveRun = runs.some((item) => item.source === 'active');

  // Escape steps back out of the full view.
  useEffect(() => {
    if (mode !== 'full') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onModeChange('third');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, onModeChange]);

  if (mode === 'closed') {
    return (
      <aside id="task-runs" className="task-traces" aria-label="Runs">
        <button
          type="button"
          className="task-runs-rail"
          onClick={() => onModeChange('third')}
          aria-label={`Open runs${runs.length ? ` (${runs.length})` : ''}`}
          aria-expanded={false}
          aria-controls="task-runs"
        >
          <Terminal size={18} />
          <span className="task-runs-rail__label">Runs</span>
          {runs.length > 0 && <span>{runs.length}</span>}
          {hasLiveRun && <span className="task-traces__dot" aria-label="A run is live" />}
        </button>
      </aside>
    );
  }

  const isFull = mode === 'full';

  return (
    <aside id="task-runs" className={`task-traces${isFull ? ' task-traces--full' : ''}`} aria-label="Runs">
      <header className="task-traces__header">
        <div className="task-traces__heading">
          <Terminal size={18} />
          <Text weight="semibold">Runs</Text>
          {runs.length > 0 && <Text size="1" tone="muted">{runs.length}</Text>}
          {hasLiveRun && <span className="task-traces__dot" aria-label="A run is live" />}
        </div>
        <div className="task-traces__header-actions">
          {run && (
            <Link className="task-traces__icon-button" to={runTracePath(run)} title="Open this trace on its own page" aria-label="Open this trace on its own page">
              <ExternalLink size={16} />
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onModeChange(isFull ? 'third' : 'full')}
            aria-label={isFull ? 'Shrink runs to the side' : 'Expand runs to full width'}
            title={isFull ? 'Shrink to the side (Esc)' : 'Expand to full width'}
          >
            {isFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onModeChange('closed')}
            aria-label="Close runs"
            title="Close runs"
            aria-expanded={true}
            aria-controls="task-runs"
          >
            <PanelRightClose size={16} />
          </Button>
        </div>
      </header>
      <div className="task-runs__list">
        <RunList
          runs={runs}
          selectedExecutionId={run?.executionId ?? null}
          onSelect={(item) => setChosenId(item.executionId)}
          onInterrupt={onInterrupt}
          interruptingExecutionIds={interruptingExecutionIds}
          isLoading={isLoadingRuns}
          error={runsError}
        />
      </div>
      {run && (
        <RunTrace key={run.executionId} run={run} onRunsChanged={onRefreshRuns} isLoadingRuns={isLoadingRuns} />
      )}
    </aside>
  );
}
