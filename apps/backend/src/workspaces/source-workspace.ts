import { DataSource, EntityManager } from 'typeorm';

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
