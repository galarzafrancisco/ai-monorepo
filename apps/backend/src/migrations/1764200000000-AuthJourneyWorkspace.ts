import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An authorization journey remembers the workspace the person was working in
 * when they consented, so tokens for Taico's own servers (tasks, context and
 * workers) are minted for that workspace instead of the person's oldest one.
 *
 * Nullable: journeys from before this have none and keep using the person's
 * oldest membership. Workspaces are only soft-deleted, so the key stays valid.
 * See docs/architecture/workspaces.md, "Many workspaces (phase 4)".
 */
export class AuthJourneyWorkspace1764200000000 implements MigrationInterface {
  name = 'AuthJourneyWorkspace1764200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "authorization_journeys" ADD "workspace_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "authorization_journeys" ADD CONSTRAINT "FK_authorization_journeys_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "authorization_journeys" DROP CONSTRAINT "FK_authorization_journeys_workspace"`);
    await queryRunner.query(`ALTER TABLE "authorization_journeys" DROP COLUMN "workspace_id"`);
  }
}
