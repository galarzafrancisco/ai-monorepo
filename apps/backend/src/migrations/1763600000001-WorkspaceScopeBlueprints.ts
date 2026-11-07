import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Workspaces phase 3a: task blueprints and their schedules get a
 * `workspace_id`, backfilled to the default workspace. Blueprints create
 * tasks and tags, so they are scoped together with tasks.
 * The join table task_blueprint_tags gets no column (see workspaces.md).
 */
const TABLES = ['task_blueprints', 'scheduled_tasks'] as const;

export class WorkspaceScopeBlueprints1763600000001 implements MigrationInterface {
  name = 'WorkspaceScopeBlueprints1763600000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
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
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "workspace_id"`,
      );
    }
  }
}
