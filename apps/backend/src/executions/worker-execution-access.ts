import { isUUID } from 'class-validator';
import { EntityManager } from 'typeorm';
import type { AuthContext } from '../auth/guards/context/auth-context.types';
import {
  ActiveTaskExecutionNotFoundError,
  ActiveTaskExecutionWorkerMismatchError,
} from './errors/executions.errors';

/** The worker making a per-execution call: its token's workspace and OAuth client. */
export type WorkerCaller = {
  workspaceId: string;
  workerClientId: string;
};

/** The caller of a worker call, from its validated token. */
export function workerCaller(auth: AuthContext): WorkerCaller {
  return { workspaceId: auth.workspaceId, workerClientId: auth.claims.client_id };
}

export type WorkerExecution = {
  workspaceId: string;
  id: string;
  taskId: string;
  agentActorId: string;
  workerClientId: string;
};

/**
 * The one check behind every worker call on an execution (REST and the
 * `/executions/worker` socket), run before anything is read or written. An
 * execution in another workspace is not found
 * (`ActiveTaskExecutionNotFoundError`). One claimed by another worker throws
 * `ActiveTaskExecutionWorkerMismatchError`. With `includeFinished`, an
 * execution already moved to history also counts (late stats, traces).
 */
export async function findWorkerExecution(
  manager: Pick<EntityManager, 'query'>,
  caller: WorkerCaller,
  executionId: string,
  options: { includeFinished?: boolean; lock?: boolean } = {},
): Promise<WorkerExecution> {
  if (!isUUID(executionId)) {
    throw new ActiveTaskExecutionNotFoundError(executionId);
  }
  const select = (table: string) => `
    SELECT workspace_id AS "workspaceId", id, task_id AS "taskId",
           agent_actor_id AS "agentActorId", worker_client_id AS "workerClientId"
    FROM ${table}
    WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL`;
  const sql = options.includeFinished
    ? `${select('active_task_executions')} UNION ALL ${select('task_execution_history')} LIMIT 1`
    : `${select('active_task_executions')}${options.lock ? ' FOR UPDATE' : ''}`;

  const [execution] = (await manager.query(sql, [executionId, caller.workspaceId])) as WorkerExecution[];
  if (!execution) {
    throw new ActiveTaskExecutionNotFoundError(executionId);
  }
  if (!caller.workerClientId || execution.workerClientId !== caller.workerClientId) {
    throw new ActiveTaskExecutionWorkerMismatchError(executionId);
  }
  return execution;
}
