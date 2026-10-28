import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, Terminal } from 'lucide-react';
import { ContextRail } from '../../../ui/primitives';
import { RunList } from './RunList';
import { RunTrace } from './RunTrace';
import { runTracePath, type TaskRun } from './runs';
import './TaskTracesPanel.css';

/**
 * Desktop side panel for troubleshooting: the task's runs and the trace of the
 * selected one (the live run by default, otherwise the latest). It shares the
 * threads details panel's shell; full screen is the run's page under Runs.
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

  return (
    <ContextRail
      title="Runs"
      icon={Terminal}
      count={runs.length > 0 ? runs.length : undefined}
      live={runs.some((item) => item.source === 'active')}
      open={open}
      onOpenChange={onOpenChange}
      scroll={false}
      actions={run && (
        <Link to={runTracePath(run)} title="Open full screen in Runs" aria-label="Open full screen in Runs">
          <Maximize2 size={16} />
        </Link>
      )}
    >
      <div className="task-traces task-traces--embedded">
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
      </div>
    </ContextRail>
  );
}
