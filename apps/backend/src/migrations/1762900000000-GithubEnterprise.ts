import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * GitHub Enterprise: each connection names the GitHub it talks to, and each
 * pull request the host it lives on. Existing rows are github.com.
 */
export class GithubEnterprise1762900000000 implements MigrationInterface {
  name = 'GithubEnterprise1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "github_connections" ADD "base_url" text NOT NULL DEFAULT 'https://github.com'`,
    );
    await queryRunner.query(`ALTER TABLE "pull_requests" ADD "host" text NOT NULL DEFAULT 'github.com'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pull_requests" DROP COLUMN "host"`);
    await queryRunner.query(`ALTER TABLE "github_connections" DROP COLUMN "base_url"`);
  }
}
