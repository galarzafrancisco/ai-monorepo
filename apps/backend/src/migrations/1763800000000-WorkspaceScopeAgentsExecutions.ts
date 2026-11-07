import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Workspaces phase 3c: agents, agent runs, executions and workers get a
 * `workspace_id`.
 *
 * - An agent is in the workspace of its actor's membership (an agent has
 *   exactly one). Its tool permissions follow the agent.
 * - Agent runs, the queue, active executions and history are in their task's
 *   workspace (phase 3a reached it through the task). Stats and traces are in
 *   their execution's.
 * - Workers are all in the default workspace: until now only default
 *   workspace tokens could connect one.
 *
 * Slugs: a person's slug stays unique across the installation (a person can
 * be in several workspaces), an agent's only within its workspace. The global
 * unique constraint on `actors.slug` becomes a partial index for people; the
 * agents service checks agent slugs per workspace. See
 * docs/architecture/workspaces.md, "Actor slugs".
 */
const TASK_CHILD_TABLES = [
  ['agent_runs', 'parent_task_id'],
  ['task_execution_queue', 'task_id'],
  ['active_task_executions', 'task_id'],
  ['task_execution_history', 'task_id'],
] as const;

const EXECUTION_CHILD_TABLES = ['execution_stats', 'execution_traces'] as const;

const TABLES = [
  'agents',
  'agent_tool_permissions',
  'agent_tool_permission_scopes',
  ...TASK_CHILD_TABLES.map(([table]) => table),
  ...EXECUTION_CHILD_TABLES,
  'workers',
] as const;

export class WorkspaceScopeAgentsExecutions1763800000000
  implements MigrationInterface
{
  name = 'WorkspaceScopeAgentsExecutions1763800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "workspace_id" uuid NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`,
      );
    }

    // An agent is in its actor's (oldest) workspace membership.
    await queryRunner.query(
      `UPDATE "agents" a SET "workspace_id" = m."workspace_id"
         FROM (
           SELECT DISTINCT ON ("actor_id") "actor_id", "workspace_id"
             FROM "workspace_members"
            ORDER BY "actor_id", "created_at" ASC
         ) m
        WHERE m."actor_id" = a."actor_id" AND a."workspace_id" <> m."workspace_id"`,
    );
    for (const table of ['agent_tool_permissions', 'agent_tool_permission_scopes']) {
      await queryRunner.query(
        `UPDATE "${table}" p SET "workspace_id" = a."workspace_id"
           FROM "agents" a
          WHERE a."actor_id" = p."agent_actor_id" AND p."workspace_id" <> a."workspace_id"`,
      );
    }
    for (const [table, taskColumn] of TASK_CHILD_TABLES) {
      await queryRunner.query(
        `UPDATE "${table}" c SET "workspace_id" = t."workspace_id"
           FROM "tasks" t
          WHERE t."id" = c."${taskColumn}" AND c."workspace_id" <> t."workspace_id"`,
      );
    }
    for (const table of EXECUTION_CHILD_TABLES) {
      for (const execution of ['active_task_executions', 'task_execution_history']) {
        await queryRunner.query(
          `UPDATE "${table}" c SET "workspace_id" = e."workspace_id"
             FROM "${execution}" e
            WHERE e."id" = c."execution_id" AND c."workspace_id" <> e."workspace_id"`,
        );
      }
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

    // A worker (an OAuth client) is registered once per workspace it works in.
    await this.dropUniqueConstraintsOn(queryRunner, 'workers', 'oauth_client_id');
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workers_workspace_oauth_client" ON "workers" ("workspace_id", "oauth_client_id")`,
    );

    // A person's slug is unique across the installation; an agent's only in
    // its workspace (checked by the agents service).
    await this.dropUniqueConstraintsOn(queryRunner, 'actors', 'slug');
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_actors_person_slug" ON "actors" ("slug") WHERE "type" <> 'agent'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_actors_slug" ON "actors" ("slug")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_actors_slug"`);
    await queryRunner.query(`DROP INDEX "UQ_actors_person_slug"`);
    await queryRunner.query(
      `ALTER TABLE "actors" ADD CONSTRAINT "UQ_d728e8d8a38480121d06532aabf" UNIQUE ("slug")`,
    );
    await queryRunner.query(`DROP INDEX "UQ_workers_workspace_oauth_client"`);
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "workspace_id"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "workers" ADD CONSTRAINT "UQ_workers_oauth_client_id" UNIQUE ("oauth_client_id")`,
    );
  }

  /** Drops every single-column unique constraint on a column, whatever it is named. */
  private async dropUniqueConstraintsOn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    const constraints: Array<{ name: string }> = await queryRunner.query(
      `SELECT c.conname AS name
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
        WHERE t.relname = $1 AND c.contype = 'u' AND a.attname = $2
          AND array_length(c.conkey, 1) = 1`,
      [table, column],
    );
    for (const { name } of constraints) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`);
    }
  }
}
