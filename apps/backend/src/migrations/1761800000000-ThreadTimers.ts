import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reminders and recurring schedules the threads agent sets for itself. Each
 * firing wakes the agent with a message the user never sees.
 */
export class ThreadTimers1761800000000 implements MigrationInterface {
  name = 'ThreadTimers1761800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "thread_timers" ("id" uuid NOT NULL, "thread_id" uuid NOT NULL, "kind" text NOT NULL, "reason" text NOT NULL, "period_seconds" integer, "max_iterations" integer NOT NULL, "fired_count" integer NOT NULL DEFAULT 0, "next_fire_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_for_actor_id" uuid NOT NULL, "pending_iteration" integer, "triggered_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_thread_timers" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_thread_timers_thread" ON "thread_timers" ("thread_id")`,
    );
    // The sweep only looks at timers that still have firings left.
    await queryRunner.query(
      `CREATE INDEX "IDX_thread_timers_due" ON "thread_timers" ("next_fire_at") WHERE "fired_count" < "max_iterations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_timers" ADD CONSTRAINT "FK_thread_timers_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_timers" ADD CONSTRAINT "FK_thread_timers_actor" FOREIGN KEY ("created_for_actor_id") REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "thread_timers"`);
  }
}
