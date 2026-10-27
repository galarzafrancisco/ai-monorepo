import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, PanelRightClose, Terminal } from 'lucide-react';
import { Button, Text } from '../../../ui/primitives';
import { RunList } from './RunList';
import { RunTrace } from './RunTrace';
import { runTracePath, type TaskRun } from './runs';
import './TaskTracesPanel.css';

/**
 * Desktop side panel for troubleshooting: the task's runs and the trace of the
 * selected one (the live run by default, otherwise the latest). It sits
 * collapsed as a slim rail; full screen is the run's page under Runs.
 */
export function TaskRunsPanel({
  runs,
  isLoadingRuns,
  runsError,
  onRefreshRuns,
  open,
  onOpenChange,
  onInterrupt,
  interruptingExecutionIds,
}: {
  runs: TaskRun[];
  isLoadingRuns: boolean;
  runsError: string | null;
  onRefreshRuns: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  if (!open) {
    return (
      <aside id="task-runs" className="task-traces task-traces--collapsed" aria-label="Runs">
        <button
          type="button"
          className="task-runs-rail"
          onClick={() => onOpenChange(true)}
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

  return (
    <aside id="task-runs" className="task-traces" aria-label="Runs">
      <header className="task-traces__header">
        <div className="task-traces__heading">
          <Text weight="semibold">Runs</Text>
          {runs.length > 0 && <Text size="2" tone="muted">· {runs.length}</Text>}
          {hasLiveRun && <span className="task-traces__dot" aria-label="A run is live" />}
        </div>
        <div className="task-traces__header-actions">
          {run && (
            <Link className="task-traces__icon-button" to={runTracePath(run)} title="Open full screen in Runs" aria-label="Open full screen in Runs">
              <Maximize2 size={16} />
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
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
        <RunTrace key={run.executionId} run={run} onRunsChanged={onRefreshRuns} isLoadingRuns={isLoadingRuns} compact />
      )}
    </aside>
  );
}
