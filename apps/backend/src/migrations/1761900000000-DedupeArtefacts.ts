import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Artefacts are identified by their link within a task. Repeated rounds of
 * work used to attach the same link (typically a PR) several times. Keep the
 * oldest live artefact per (task, link) and soft-delete the rest.
 */
export class DedupeArtefacts1761900000000 implements MigrationInterface {
  name = 'DedupeArtefacts1761900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "artefacts" SET "deleted_at" = now()
       WHERE "id" IN (
         SELECT "id" FROM (
           SELECT "id", ROW_NUMBER() OVER (
             PARTITION BY "task_id", "link"
             ORDER BY "created_at" ASC, "id" ASC
           ) AS "rn"
           FROM "artefacts"
           WHERE "deleted_at" IS NULL
         ) "ranked"
         WHERE "ranked"."rn" > 1
       )`,
    );
  }

  public async down(): Promise<void> {
    // Data-only cleanup: the removed duplicates are indistinguishable from
    // artefacts deleted for other reasons, so there is nothing to restore.
  }
}
