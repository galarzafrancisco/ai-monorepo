import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Workspaces phase 3a: tasks, context blocks and meta (tags, projects) get a
 * `workspace_id`. Existing rows are backfilled to the default workspace.
 *
 * Join tables (task_tags, task_dependencies, context_block_tags,
 * project_auto_tags, task_auto_tags) get no column: they are only reached
 * through a parent that is already scoped. See docs/architecture/workspaces.md.
 */
export const WORKSPACE_SCOPED_TABLES_3A = [
  'tags',
  'tag_usage',
  'projects',
  'context_blocks',
  'tasks',
  'comments',
  'artefacts',
  'task_input_requests',
] as const;

export class WorkspaceScopeTasksContextMeta1763600000000 implements MigrationInterface {
  name = 'WorkspaceScopeTasksContextMeta1763600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of WORKSPACE_SCOPED_TABLES_3A) {
      // Adding the column with a default fills existing rows in one step; the
      // default is dropped right after so every new row has to say where it
      // belongs.
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "workspace_id" uuid NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`,
      );
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

    // Tag names are unique per workspace (case-insensitive).
    await queryRunner.query(`DROP INDEX "uq_tags_name_ci"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tags_workspace_name_ci" ON "tags" ("workspace_id", lower("name"))`,
    );

    // Project slugs are unique per workspace.
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "UQ_96e045ab8b0271e5f5a91eae1ee"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_projects_workspace_slug" ON "projects" ("workspace_id", "slug")`,
    );

    // Tasks are listed by workspace, newest first.
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_workspace_status_updated" ON "tasks" ("workspace_id", "status", "updated_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_tasks_workspace_status_updated"`);
    await queryRunner.query(`DROP INDEX "UQ_projects_workspace_slug"`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "UQ_96e045ab8b0271e5f5a91eae1ee" UNIQUE ("slug")`,
    );
    await queryRunner.query(`DROP INDEX "uq_tags_workspace_name_ci"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tags_name_ci" ON "tags" (lower("name"))`,
    );
    for (const table of [...WORKSPACE_SCOPED_TABLES_3A].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "workspace_id"`,
      );
    }
  }
}
