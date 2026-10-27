import type {
  ActiveTaskExecutionResponseDto,
  TaskExecutionHistoryResponseDto,
} from '@taico/client/v2';
import type { DataRowTag } from '../../../ui/primitives';
import { ExecutionsService } from '../../executions/api';

/** One time an agent worked on a task, live or finished. Each run has its own trace. */
export type TaskRun = {
  id: string;
  executionId: string;
  agentActorId: string;
  status: 'ACTIVE' | TaskExecutionHistoryResponseDto['status'];
  source: 'active' | 'history';
  timestamp: string;
  lastActivityAt: string;
  runnerSessionId: string | null;
  toolCallCount: number;
  errorCode: TaskExecutionHistoryResponseDto['errorCode'] | null;
  errorMessage: string | null;
};

/** What a trace needs to know about its run. */
export type TraceRun = Pick<TaskRun, 'executionId' | 'agentActorId' | 'status' | 'source' | 'timestamp'>;

export const POTENTIALLY_STALE_THRESHOLD_MS = 10 * 60 * 1000;
export const POTENTIALLY_STALE_MESSAGE = "We haven't seen activity in a while. If the worker doesn't report back, we'll mark this run as stale and revert the task to its previous state, where another agent will pick it";

/** Active and finished runs for a task, newest first. */
export async function loadTaskRuns(taskId: string): Promise<TaskRun[]> {
  const [activeResponse, historyResponse] = await Promise.all([
    ExecutionsService.ActiveTaskExecutionController_listActiveExecutions({ taskId, limit: 100 }),
    ExecutionsService.TaskExecutionHistoryController_listHistory({ taskId, limit: 100 }),
  ]);

  const active = activeResponse.items.map((entry: ActiveTaskExecutionResponseDto): TaskRun => ({
    id: `active-${entry.id}`,
    executionId: entry.id,
    agentActorId: entry.agentActorId,
    status: 'ACTIVE',
    source: 'active',
    timestamp: entry.claimedAt,
    lastActivityAt: entry.lastHeartbeatAt ?? entry.claimedAt,
    runnerSessionId: entry.runnerSessionId,
    toolCallCount: entry.toolCallCount,
    errorCode: null,
    errorMessage: null,
  }));

  const history = historyResponse.items.map((entry: TaskExecutionHistoryResponseDto): TaskRun => ({
    id: `history-${entry.id}`,
    executionId: entry.id,
    agentActorId: entry.agentActorId,
    status: entry.status,
    source: 'history',
    timestamp: entry.transitionedAt,
    lastActivityAt: entry.transitionedAt,
    runnerSessionId: entry.runnerSessionId,
    toolCallCount: entry.toolCallCount,
    errorCode: entry.errorCode,
    errorMessage: entry.errorMessage,
  }));

  return [...active, ...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function runStatusLabel(run: Pick<TaskRun, 'status' | 'source'>): string {
  if (run.source === 'active') return 'Running';
  return ({
    SUCCEEDED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    STALE: 'Stale',
  } as Record<string, string>)[run.status] ?? run.status;
}

export function runStatusTag(run: Pick<TaskRun, 'status' | 'source'>): DataRowTag {
  const label = runStatusLabel(run).toLowerCase();
  if (run.source === 'active') return { label, color: 'blue' };
  if (run.status === 'SUCCEEDED') return { label, color: 'green' };
  if (run.status === 'FAILED') return { label, color: 'red' };
  if (run.status === 'STALE') return { label, color: 'orange' };
  return { label, color: 'gray' };
}

export function isRunPotentiallyStale(run: Pick<TaskRun, 'source' | 'lastActivityAt'>, now: number): boolean {
  return run.source === 'active' && now - new Date(run.lastActivityAt).getTime() >= POTENTIALLY_STALE_THRESHOLD_MS;
}

/** The full-page trace for a run. */
export function runTracePath(run: Pick<TaskRun, 'source' | 'executionId'>): string {
  return `/runs/${run.source}/${run.executionId}/traces`;
}
