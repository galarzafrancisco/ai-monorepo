import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expressions of interest submitted from the public /join page.
 * No IP address or fingerprint is stored. Retention: admins delete rows from
 * Settings > Access requests (DELETE /admin/access-requests/:id).
 */
export class AccessRequests1762300000000 implements MigrationInterface {
  name = 'AccessRequests1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "access_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "email_normalized" varchar(320) NOT NULL,
        "building" varchar(280) NULL,
        "status" varchar(16) NOT NULL DEFAULT 'new',
        "submission_count" integer NOT NULL DEFAULT 1,
        "reviewed_at" timestamptz NULL,
        "reviewed_by_actor_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_submitted_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_requests_id" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_access_requests_email_normalized" ON "access_requests" ("email_normalized")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "access_requests"`);
  }
}
