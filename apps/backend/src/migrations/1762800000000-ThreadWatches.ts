import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Generic thread watches (a pull request today) and the notifications queued
 * for the threads agent.
 */
export class ThreadWatches1762800000000 implements MigrationInterface {
  name = 'ThreadWatches1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "thread_watches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "thread_id" uuid NOT NULL,
        "kind" text NOT NULL,
        "target_id" uuid NOT NULL,
        "target_label" text NOT NULL,
        "target_url" text NULL,
        "conditions" jsonb NOT NULL DEFAULT '[]',
        "once" boolean NOT NULL DEFAULT true,
        "waiting_for" text NULL,
        "subscribed_for_actor_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_thread_watches_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_thread_watches_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_thread_watches_actor" FOREIGN KEY ("subscribed_for_actor_id") REFERENCES "actors"("id")
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_thread_watches_target" ON "thread_watches" ("thread_id", "kind", "target_id")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_thread_watches_kind_target" ON "thread_watches" ("kind", "target_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_thread_watches_expires_at" ON "thread_watches" ("expires_at")`);

    await queryRunner.query(`
      CREATE TABLE "thread_watch_deliveries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "thread_id" uuid NOT NULL,
        "watch_id" uuid NOT NULL,
        "kind" text NOT NULL,
        "message" text NOT NULL,
        "for_actor_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_thread_watch_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_thread_watch_deliveries_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_thread_watch_deliveries_thread" ON "thread_watch_deliveries" ("thread_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "thread_watch_deliveries"`);
    await queryRunner.query(`DROP TABLE "thread_watches"`);
  }
}
