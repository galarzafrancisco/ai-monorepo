import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, PanelRightClose, PanelRightOpen, Terminal } from 'lucide-react';
import { Button, Text } from '../../../ui/primitives';
import { RunList } from './RunList';
import { RunTrace } from './RunTrace';
import { runTracePath, type TaskRun } from './runs';
import './TaskTracesPanel.css';

/**
 * Desktop side panel: the task's runs, and the trace of the selected one
 * (the live run by default, otherwise the latest). "Full view" opens the
 * same trace on its own page.
 */
export function TaskRunsPanel({
  runs,
  isLoadingRuns,
  runsError,
  onRefreshRuns,
  open,
  onToggle,
  onInterrupt,
  interruptingExecutionIds,
}: {
  runs: TaskRun[];
  isLoadingRuns: boolean;
  runsError: string | null;
  onRefreshRuns: () => void;
  open: boolean;
  onToggle: () => void;
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
        <Button
          variant="ghost"
          className="task-traces__expand"
          onClick={onToggle}
          aria-label="Expand runs"
          aria-expanded={false}
          aria-controls="task-runs"
        >
          <PanelRightOpen size={18} />
          <span>Runs</span>
          {hasLiveRun && <span className="task-traces__dot" />}
        </Button>
      </aside>
    );
  }

  return (
    <aside id="task-runs" className="task-traces" aria-label="Runs">
      <header className="task-traces__header">
        <div className="task-traces__heading">
          <Terminal size={18} />
          <Text weight="semibold">Runs</Text>
          {runs.length > 0 && <Text size="1" tone="muted">{runs.length}</Text>}
          {hasLiveRun && <span className="task-traces__dot" aria-label="A run is live" />}
        </div>
        <div className="task-traces__header-actions">
          {run && (
            <Link className="task-traces__full-view" to={runTracePath(run)} title="Open this trace in a full page">
              <Maximize2 size={14} />
              Full view
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            aria-label="Collapse runs"
            aria-expanded={true}
            aria-controls="task-runs"
          >
            <PanelRightClose size={18} />
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
