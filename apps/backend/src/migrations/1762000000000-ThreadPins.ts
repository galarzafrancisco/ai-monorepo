import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets each actor pin threads to the top of their own thread list.
 */
export class ThreadPins1762000000000 implements MigrationInterface {
  name = 'ThreadPins1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "thread_pins" ("thread_id" uuid NOT NULL, "actor_id" uuid NOT NULL, "pinned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_thread_pins" PRIMARY KEY ("thread_id", "actor_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_pins" ADD CONSTRAINT "FK_thread_pins_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_pins" ADD CONSTRAINT "FK_thread_pins_actor" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // The list joins pins by actor.
    await queryRunner.query(
      `CREATE INDEX "IDX_thread_pins_actor" ON "thread_pins" ("actor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "thread_pins"`);
  }
}
