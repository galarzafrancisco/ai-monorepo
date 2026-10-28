import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * GitHub connections (a personal access token or a GitHub App installation),
 * and which one a project uses. The credential itself lives in `secrets`.
 */
export class GithubConnections1762600000000 implements MigrationInterface {
  name = 'GithubConnections1762600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "github_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "auth_type" text NOT NULL,
        "secret_id" uuid NOT NULL,
        "app_id" text NULL,
        "installation_id" text NULL,
        "owners" text[] NOT NULL DEFAULT '{}',
        "account_login" text NULL,
        "last_verified_at" timestamptz NULL,
        "last_error" text NULL,
        "row_version" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_github_connections_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_github_connections_secret" FOREIGN KEY ("secret_id") REFERENCES "secrets"("id")
      )`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "github_connection_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "github_for_worker" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`
      ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_github_connection"
        FOREIGN KEY ("github_connection_id") REFERENCES "github_connections"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_github_connection"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "github_for_worker"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "github_connection_id"`);
    await queryRunner.query(`DROP TABLE "github_connections"`);
  }
}
