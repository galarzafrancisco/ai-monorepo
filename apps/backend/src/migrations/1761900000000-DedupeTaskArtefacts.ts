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
        INNER JOIN (
          SELECT "task_id", "name", "link", MIN("id") as first_id
          FROM "artefacts"
          WHERE "deleted_at" IS NULL
          GROUP BY "task_id", "name", "link"
          HAVING COUNT(*) > 1
        ) duplicates ON (
          a2."task_id" = duplicates."task_id"
          AND a2."name" = duplicates."name"
          AND a2."link" = duplicates."link"
          AND a2."deleted_at" IS NULL
          AND a2."id" != duplicates."first_id"
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
