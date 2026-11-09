import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Workspace invitations: an invite no longer adds anyone, existing account
 * or not. It is accepted with a one-time code (only its hash is stored).
 * See docs/architecture/workspaces.md, "Invitations".
 */
export class WorkspaceInvitations1764300000000 implements MigrationInterface {
  name = 'WorkspaceInvitations1764300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspace_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "email" text NOT NULL,
        "role" text NOT NULL,
        "code_hash" text NOT NULL,
        "invited_by_actor_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "accepted_by_actor_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_invitations_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_workspace_invitations_code_hash" ON "workspace_invitations" ("code_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_workspace_invitations_workspace_email" ON "workspace_invitations" ("workspace_id", "email")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "workspace_invitations"`);
  }
}
