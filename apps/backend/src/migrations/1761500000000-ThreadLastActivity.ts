import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the time of the latest message people can see in each thread, which
 * the thread list is ordered by.
 *
 * Existing threads get the time of their newest message, or their creation
 * time when they have none.
 */
export class ThreadLastActivity1761500000000 implements MigrationInterface {
  name = 'ThreadLastActivity1761500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "threads" ADD "last_activity_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "threads" t SET "last_activity_at" = COALESCE((SELECT MAX(m."created_at") FROM "thread_messages" m WHERE m."thread_id" = t."id"), t."created_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" ALTER COLUMN "last_activity_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" ALTER COLUMN "last_activity_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_threads_last_activity" ON "threads" ("last_activity_at", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_threads_last_activity"`);
    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN "last_activity_at"`);
  }
}
