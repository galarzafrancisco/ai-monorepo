import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A subscription remembers what the user wants from the task, so the threads
 * agent can answer that when the task finishes instead of reporting a status.
 */
export class ThreadTaskSubscriptionWaitingFor1761100000000 implements MigrationInterface {
  name = 'ThreadTaskSubscriptionWaitingFor1761100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "thread_task_subscriptions" ADD "waiting_for" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "thread_task_subscriptions" DROP COLUMN "waiting_for"`,
    );
  }
}
