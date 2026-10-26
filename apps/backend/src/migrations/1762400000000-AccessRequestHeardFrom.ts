import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Where did you hear about Taico?" on /join. Both columns are nullable so
 * requests submitted before this existed stay valid. The free text is only
 * kept when the visitor picked "other".
 */
export class AccessRequestHeardFrom1762400000000 implements MigrationInterface {
  name = 'AccessRequestHeardFrom1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "access_requests"
        ADD COLUMN "heard_from" varchar(32) NULL,
        ADD COLUMN "heard_from_other" varchar(120) NULL,
        ADD CONSTRAINT "CHK_access_requests_heard_from_other"
          CHECK ("heard_from_other" IS NULL OR "heard_from" = 'other')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "access_requests"
        DROP CONSTRAINT "CHK_access_requests_heard_from_other",
        DROP COLUMN "heard_from_other",
        DROP COLUMN "heard_from"`);
  }
}
