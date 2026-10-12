import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Threads can subscribe to tasks: the threads agent is told when a subscribed
 * task goes to review or is done.
 */
export class ThreadTaskSubscriptions1761000000000 implements MigrationInterface {
  name = 'ThreadTaskSubscriptions1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "thread_task_subscriptions" ("thread_id" uuid NOT NULL, "task_id" uuid NOT NULL, "subscribed_for_actor_id" uuid NOT NULL, "triggered_status" text, "triggered_task_name" text, "triggered_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_thread_task_subscriptions" PRIMARY KEY ("thread_id", "task_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_thread_task_subscriptions_task" ON "thread_task_subscriptions" ("task_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_task_subscriptions" ADD CONSTRAINT "FK_thread_task_subscriptions_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_task_subscriptions" ADD CONSTRAINT "FK_thread_task_subscriptions_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_task_subscriptions" ADD CONSTRAINT "FK_thread_task_subscriptions_actor" FOREIGN KEY ("subscribed_for_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "thread_task_subscriptions"`);
  }
}
