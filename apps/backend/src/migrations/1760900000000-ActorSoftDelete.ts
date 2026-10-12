import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Actors (agents and humans) can be deleted without breaking the tasks,
 * comments and context they touched: the actor row stays and is marked with
 * "deleted_at". Agents and users removed before this migration are backfilled,
 * and deleted agents release their slug so it can be used again.
 */
export class ActorSoftDelete1760900000000 implements MigrationInterface {
  name = 'ActorSoftDelete1760900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "actors" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "actors" a SET "deleted_at" = ag."deleted_at", "slug" = a."slug" || '~deleted-' || left(a."id"::text, 8) FROM "agents" ag WHERE ag."actor_id" = a."id" AND ag."deleted_at" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "actors" a SET "deleted_at" = COALESCE(u."deletedAt", u."updatedAt") FROM "users" u WHERE u."actor_id" = a."id" AND (u."isActive" = false OR u."deletedAt" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Slugs released by deleted agents keep their "~deleted-" suffix: the
    // original may have been taken by another actor since.
    await queryRunner.query(`ALTER TABLE "actors" DROP COLUMN "deleted_at"`);
  }
}
