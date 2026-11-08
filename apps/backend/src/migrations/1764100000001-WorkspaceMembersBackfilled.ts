import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Workspaces phase 4: records that the startup backfill of pre-workspace
 * memberships has run, so it runs once per installation instead of on every
 * startup. Without this, a person removed from every workspace would be put
 * back in the default one on the next restart.
 *
 * Left NULL here: the first startup after this runs the backfill one last
 * time (a no-op where phase 1 already ran) and then sets it.
 * See docs/architecture/workspaces.md, "The default workspace".
 */
export class WorkspaceMembersBackfilled1764100000001 implements MigrationInterface {
  name = 'WorkspaceMembersBackfilled1764100000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD "members_backfilled_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "members_backfilled_at"`);
  }
}
