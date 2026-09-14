import { TaskStatus } from '../../../tasks/enums';
import { TaskExecutionHistoryErrorCode } from '../../history/task-execution-history-error-code.enum';
import { TaskExecutionHistoryStatus } from '../../history/task-execution-history-status.enum';
import { ActorResult } from '../../../tasks/dto/service/tasks.service.types';

export type ExecutionStatsResult = {
  harness: string | null;
  providerId: string | null;
  modelId: string | null;
  workerVersion: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type TaskExecutionQueueEntryResult = {
  taskId: string;
  taskName: string | null;
  taskStatus: TaskStatus | null;
};

export type TaskExecutionQueueListResult = {
  items: TaskExecutionQueueEntryResult[];
  total: number;
  page: number;
  limit: number;
};

export type ActiveTaskExecutionTagSnapshotResult = {
  id: string;
  name: string;
};

export type ActiveTaskExecutionResult = {
  id: string;
  taskId: string;
  taskName: string | null;
  taskStatus: TaskStatus | null;
  claimedAt: Date;
  lastHeartbeatAt: Date | null;
  runnerSessionId: string | null;
  toolCallCount: number;
  taskStatusBeforeClaim: TaskStatus;
  taskTagsBeforeClaim: ActiveTaskExecutionTagSnapshotResult[];
  workerClientId: string;
  taskAssigneeActorIdBeforeClaim: string | null;
  agentActorId: string;
  agentActor: ActorResult | null;
  stats: ExecutionStatsResult | null;
};

export type ActiveTaskExecutionListResult = {
  items: ActiveTaskExecutionResult[];
  total: number;
  page: number;
  limit: number;
};

export type TaskExecutionHistoryResult = {
  id: string;
  taskId: string;
  taskName: string | null;
  taskStatus: TaskStatus | null;
  claimedAt: Date;
  transitionedAt: Date;
  agentActorId: string;
  agentActor: ActorResult | null;
  workerClientId: string;
  runnerSessionId: string | null;
  toolCallCount: number;
  status: TaskExecutionHistoryStatus;
  errorCode: TaskExecutionHistoryErrorCode | null;
  errorMessage: string | null;
  stats: ExecutionStatsResult | null;
};

export type TaskExecutionHistoryListResult = {
  items: TaskExecutionHistoryResult[];
  total: number;
  page: number;
  limit: number;
};
