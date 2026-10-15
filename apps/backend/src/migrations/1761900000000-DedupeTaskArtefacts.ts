import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deduplicates existing task artifacts. When multiple rounds of work attach
 * the same artifact (by name and link) to a task, this migration retains one
 * active artifact per (task_id, name, link) group and soft-deletes the others.
 * The artifact with the earliest created_at is retained.
 */
export class DedupeTaskArtefacts1761900000000 implements MigrationInterface {
  name = 'DedupeTaskArtefacts1761900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Find duplicate artifacts (same task_id, name, and link with deleted_at IS NULL)
    // and soft-delete all but the first one (by created_at)
    await queryRunner.query(`
      UPDATE "artefacts" a
      SET "deleted_at" = NOW()
      WHERE a."id" IN (
        SELECT a2."id"
        FROM "artefacts" a2
        WHERE a2."deleted_at" IS NULL
        AND EXISTS (
          SELECT 1
          FROM "artefacts" a3
          WHERE a3."task_id" = a2."task_id"
          AND a3."name" = a2."name"
          AND a3."link" = a2."link"
          AND a3."deleted_at" IS NULL
          AND a3."created_at" < a2."created_at"
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // For safety, do not restore soft-deleted duplicates on rollback.
    // The current data state is the source of truth; restoring would
    // risk re-introducing hidden duplicates if the rollback is partial.
    // Manual recovery can restore from backup if needed.
  }
}
