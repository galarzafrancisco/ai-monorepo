import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Workspaces phase 3d: AI providers, model selections, ChatGPT plan
 * connections and secrets get a `workspace_id`.
 *
 * Every existing row moves to the default workspace as it is. There is
 * nothing to merge: providers, selections and secrets were installation-wide
 * rows with no owner, and the only per-person rows (ChatGPT plan connections
 * and unfinished sign-ins) belong to a provider, which is now in the default
 * workspace with them.
 *
 * Uniqueness becomes per workspace: one selection per (workspace, job), one
 * ChatGPT plan provider per workspace, and secret names per workspace.
 * See docs/architecture/workspaces.md, "AI models and secrets (phase 3d)".
 */
const TABLES = [
  'secrets',
  'ai_providers',
  'ai_model_selections',
  'ai_provider_connections',
  'ai_provider_authorization_attempts',
] as const;

export class WorkspaceScopeAiModelsSecrets1763900000000 implements MigrationInterface {
  name = 'WorkspaceScopeAiModelsSecrets1763900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "workspace_id" uuid NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`,
      );
      // New rows have to say where they belong.
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "workspace_id" DROP DEFAULT`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT`,
      );
      await queryRunner.query(`CREATE INDEX "IDX_${table}_workspace" ON "${table}" ("workspace_id")`);
    }

    // One selection per job in each workspace.
    await this.dropPrimaryKey(queryRunner, 'ai_model_selections');
    await queryRunner.query(
      `ALTER TABLE "ai_model_selections" ADD CONSTRAINT "PK_ai_model_selections" PRIMARY KEY ("workspace_id", "job")`,
    );

    // One ChatGPT plan provider in each workspace.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ai_providers_chatgpt_subscription"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_providers_workspace_chatgpt_subscription" ON "ai_providers" ("workspace_id", "type") WHERE "type" = 'chatgpt_subscription' AND "deleted_at" IS NULL`,
    );

    // Secret names are unique in each workspace.
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_secrets_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_secrets_workspace_name" ON "secrets" ("workspace_id", "name") WHERE "deleted_at" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_secrets_workspace_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_secrets_name" ON "secrets" ("name") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "UQ_ai_providers_workspace_chatgpt_subscription"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_providers_chatgpt_subscription" ON "ai_providers" ("type") WHERE "type" = 'chatgpt_subscription' AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "ai_model_selections" DROP CONSTRAINT "PK_ai_model_selections"`);
    await queryRunner.query(
      `ALTER TABLE "ai_model_selections" ADD CONSTRAINT "PK_ai_model_selections" PRIMARY KEY ("job")`,
    );
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "workspace_id"`);
    }
  }

  /** Drops the table's primary key, whatever it is named. */
  private async dropPrimaryKey(queryRunner: QueryRunner, table: string): Promise<void> {
    const rows: Array<{ name: string }> = await queryRunner.query(
      `SELECT c.conname AS name
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = $1 AND c.contype = 'p'`,
      [table],
    );
    for (const { name } of rows) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`);
    }
  }
}
