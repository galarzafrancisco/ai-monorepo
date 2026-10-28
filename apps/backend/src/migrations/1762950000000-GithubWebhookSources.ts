import { MigrationInterface, QueryRunner } from 'typeorm';

/** Which repositories (or whole owners) each GitHub connection receives webhooks for. */
export class GithubWebhookSources1762950000000 implements MigrationInterface {
  name = 'GithubWebhookSources1762950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "github_webhook_sources" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "connection_id" uuid NOT NULL,
        "owner" text NOT NULL,
        "repo" text NULL,
        "owner_key" text NOT NULL,
        "repo_key" text NOT NULL,
        "last_delivery_at" timestamptz NOT NULL,
        "last_event" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_github_webhook_sources_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_github_webhook_sources_connection" FOREIGN KEY ("connection_id")
          REFERENCES "github_connections"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_github_webhook_sources_target" ON "github_webhook_sources" ("connection_id", "owner_key", "repo_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_github_webhook_sources_last_delivery_at" ON "github_webhook_sources" ("last_delivery_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "github_webhook_sources"`);
  }
}
