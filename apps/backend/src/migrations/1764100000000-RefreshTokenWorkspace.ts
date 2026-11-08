import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Workspaces phase 4: a web refresh token remembers the workspace its session
 * is in, so refreshing keeps the workspace the person switched to.
 *
 * Nullable: tokens minted before this have none, and refresh then uses the
 * person's oldest membership, as login does. A deleted workspace clears it.
 * See docs/architecture/workspaces.md, "Many workspaces (phase 4)".
 */
export class RefreshTokenWorkspace1764100000000 implements MigrationInterface {
  name = 'RefreshTokenWorkspace1764100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "workspace_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_workspace"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "workspace_id"`);
  }
}
