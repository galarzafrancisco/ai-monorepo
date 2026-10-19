import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Threads are deleted for real from now on, together with their state block.
 *
 * A soft-deleted thread kept its row, and with it the RESTRICT foreign key to
 * its state block: the block could never be deleted, and the context page
 * still offered a link to the deleted thread.
 *
 * Removes the threads soft-deleted so far (their messages, links, timers, pins
 * and the rest go by cascade), then their state blocks, unless another block
 * was nested under one. Then drops `deleted_at`; the one-thread-per-parent-task
 * index no longer needs to skip deleted rows.
 *
 * `down` brings the column back, not the removed threads.
 */
export class ThreadHardDelete1762200000000 implements MigrationInterface {
  name = 'ThreadHardDelete1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const removed: Array<{ state_context_block_id: string }> = await queryRunner.query(
      `DELETE FROM "threads" WHERE "deleted_at" IS NOT NULL RETURNING "state_context_block_id"`,
    );
    const blockIds = removed.map((row) => row.state_context_block_id);
    if (blockIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM "context_blocks" b
          WHERE b."id" = ANY($1::uuid[])
            AND NOT EXISTS (SELECT 1 FROM "threads" t WHERE t."state_context_block_id" = b."id")
            AND NOT EXISTS (SELECT 1 FROM "context_blocks" c WHERE c."parent_id" = b."id")`,
        [blockIds],
      );
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."uq_threads_parent_task_id_non_null"`);
    await queryRunner.query(`ALTER TABLE "threads" DROP COLUMN "deleted_at"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_threads_parent_task_id_non_null" ON "threads" ("parent_task_id") WHERE "parent_task_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."uq_threads_parent_task_id_non_null"`);
    await queryRunner.query(`ALTER TABLE "threads" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_threads_parent_task_id_non_null" ON "threads" ("parent_task_id") WHERE "parent_task_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
  }
}
