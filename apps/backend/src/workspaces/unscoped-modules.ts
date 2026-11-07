import { DataSource, EntityManager } from 'typeorm';
import { UNSCOPED_MODULE_WORKSPACE_ID } from './workspaces.constants';
import { NotInWorkspaceError } from './workspace.errors';

/**
 * Modules without `workspace_id` yet (MCP registry, AI providers, GitHub data...)
 * hold rows of the default workspace only. This is the one rule for every
 * path into them, direct or through another module: only the default
 * workspace reaches them. `@WorkspaceAccess('default-only')` applies it at
 * the door; services that other modules call apply it here. Each phase 3
 * task replaces a module's uses with a real `workspace_id` filter.
 */
export function holdsUnscopedModuleData(workspaceId: string): boolean {
  return workspaceId === UNSCOPED_MODULE_WORKSPACE_ID;
}

/** Throws NotInWorkspace (404) unless the workspace may reach unscoped modules. */
export function assertHoldsUnscopedModuleData(workspaceId: string): void {
  if (!holdsUnscopedModuleData(workspaceId)) {
    throw new NotInWorkspaceError();
  }
}

/**
 * The workspace of the task or thread a link was written in, or null when it
 * is gone. Soft-deleted rows still count.
 */
export async function workspaceOfSource(
  db: DataSource | EntityManager,
  source: { taskId?: string | null; threadId?: string | null },
): Promise<string | null> {
  if (source.taskId) {
    const rows: Array<{ workspace_id: string }> = await db.query(
      `SELECT workspace_id FROM tasks WHERE id = $1`,
      [source.taskId],
    );
    return rows[0]?.workspace_id ?? null;
  }
  if (source.threadId) {
    const rows: Array<{ workspace_id: string }> = await db.query(
      `SELECT workspace_id FROM threads WHERE id = $1`,
      [source.threadId],
    );
    return rows[0]?.workspace_id ?? null;
  }
  return null;
}
