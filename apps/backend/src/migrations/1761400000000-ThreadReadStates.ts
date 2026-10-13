import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records how far each actor has read each thread, so the UI can show which
 * threads have unread messages.
 *
 * Existing threads are marked as read for every current person. Without this,
 * every message ever written by someone else would show as unread on first load.
 */
export class ThreadReadStates1761400000000 implements MigrationInterface {
  name = 'ThreadReadStates1761400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "thread_read_states" ("thread_id" uuid NOT NULL, "actor_id" uuid NOT NULL, "last_read_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_thread_read_states" PRIMARY KEY ("thread_id", "actor_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_read_states" ADD CONSTRAINT "FK_thread_read_states_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_read_states" ADD CONSTRAINT "FK_thread_read_states_actor" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_thread_messages_thread_created" ON "thread_messages" ("thread_id", "created_at")`,
    );
    await queryRunner.query(
      `INSERT INTO "thread_read_states" ("thread_id", "actor_id", "last_read_at") SELECT t."id", a."id", now() FROM "threads" t CROSS JOIN "actors" a WHERE a."type" = 'human' AND a."deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_thread_messages_thread_created"`);
    await queryRunner.query(`DROP TABLE "thread_read_states"`);
  }
}
