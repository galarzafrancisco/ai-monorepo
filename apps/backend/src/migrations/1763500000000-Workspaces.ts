import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Adds workspaces and workspace members, and creates the default workspace.
 *
 * The default workspace row is created here, not only at startup, because
 * later migrations backfill `workspace_id` columns with its id (and an FK to
 * it) and run before the app starts. Memberships are added at startup by
 * `WorkspacesService.onModuleInit`, which owns the role rule.
 */
export class Workspaces1763500000000 implements MigrationInterface {
  name = 'Workspaces1763500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" text NOT NULL,
        "name" text NOT NULL,
        "row_version" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_workspaces_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_workspaces" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "workspace_members" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "role" text NOT NULL DEFAULT 'member',
        "row_version" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspace_members_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_workspace_members_actor" FOREIGN KEY ("actor_id")
          REFERENCES "actors"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workspace_members_workspace_actor" ON "workspace_members" ("workspace_id", "actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workspace_members_actor" ON "workspace_members" ("actor_id")`,
    );

    await queryRunner.query(
      `INSERT INTO "workspaces" ("id", "slug", "name", "row_version") VALUES ($1, 'default', 'Default workspace', 1)`,
      [DEFAULT_WORKSPACE_ID],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "workspace_members"');
    await queryRunner.query('DROP TABLE "workspaces"');
  }
}
