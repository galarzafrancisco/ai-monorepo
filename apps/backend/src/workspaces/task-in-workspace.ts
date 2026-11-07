import { FindOperator, Raw } from 'typeorm';

/**
 * SQL that keeps a task id only when the task is in the given workspace.
 * Tables that hang off a task (execution queue, active executions, history,
 * agent runs) have no `workspace_id` of their own until phase 3c, so the
 * user-facing routes reach the workspace through the task. Soft-deleted tasks
 * still match, so their history stays visible.
 */
export const TASK_IN_WORKSPACE_SQL = (column: string, param = 'taskWorkspaceId') =>
  `${column} IN (SELECT id FROM tasks WHERE workspace_id = :${param})`;

/** A `where` value for a task id column: in the workspace (and equal to `taskId`, when given). */
export function taskIdInWorkspace(
  workspaceId: string,
  taskId?: string,
): FindOperator<string> {
  return Raw(
    (alias) =>
      taskId
        ? `${alias} = :taskWorkspaceTaskId AND ${TASK_IN_WORKSPACE_SQL(alias)}`
        : TASK_IN_WORKSPACE_SQL(alias),
    { taskWorkspaceId: workspaceId, taskWorkspaceTaskId: taskId },
  );
}
