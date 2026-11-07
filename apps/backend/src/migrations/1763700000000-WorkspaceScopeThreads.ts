import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Workspaces phase 3b: threads and every table that hangs off a thread get a
 * `workspace_id`.
 *
 * Until now a thread's workspace was its state block's, so threads are
 * backfilled from their state block, and every child row from its thread.
 * The constant default only covers the instant between ADD and UPDATE.
 *
 * No unique constraint changes: every thread constraint is keyed by a thread
 * id (one parent-task thread, one running turn, one watch per target...), and
 * a thread is in one workspace, so they are already per workspace.
 *
 * Join tables (thread_tasks, thread_context_blocks, thread_tags,
 * thread_participants) get no column: they are only reached through the
 * thread, and the service resolves both ends in the thread's workspace. See
 * docs/architecture/workspaces.md.
 */
export const WORKSPACE_SCOPED_THREAD_CHILD_TABLES = [
  'thread_messages',
  'thread_agent_messages',
  'thread_turns',
  'thread_pins',
  'thread_read_states',
  'thread_task_subscriptions',
  'thread_timers',
  'thread_timer_firings',
  'thread_watches',
  'thread_watch_deliveries',
] as const;

const TABLES = ['threads', ...WORKSPACE_SCOPED_THREAD_CHILD_TABLES] as const;

export class WorkspaceScopeThreads1763700000000 implements MigrationInterface {
  name = 'WorkspaceScopeThreads1763700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "workspace_id" uuid NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`,
      );
    }

    // A thread is in its state block's workspace (phase 3a's rule).
    await queryRunner.query(
      `UPDATE "threads" t SET "workspace_id" = b."workspace_id"
         FROM "context_blocks" b
        WHERE b."id" = t."state_context_block_id" AND t."workspace_id" <> b."workspace_id"`,
    );
    // Every child row is in its thread's workspace.
    for (const table of WORKSPACE_SCOPED_THREAD_CHILD_TABLES) {
      await queryRunner.query(
        `UPDATE "${table}" c SET "workspace_id" = t."workspace_id"
           FROM "threads" t
          WHERE t."id" = c."thread_id" AND c."workspace_id" <> t."workspace_id"`,
      );
    }

    for (const table of TABLES) {
      // New rows have to say where they belong.
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "workspace_id" DROP DEFAULT`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_workspace" ON "${table}" ("workspace_id")`,
      );
    }

    // The thread list: one workspace, latest activity first.
    await queryRunner.query(
      `CREATE INDEX "IDX_threads_workspace_last_activity" ON "threads" ("workspace_id", "last_activity_at", "id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_threads_workspace_last_activity"`);
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "workspace_id"`,
      );
    }
  }
}
