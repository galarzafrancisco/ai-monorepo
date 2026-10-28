import { MigrationInterface, QueryRunner } from 'typeorm';

/** Durable handoff when a thread agent request conflicts with an active turn. */
export class ThreadTurnRequests1763000000000 implements MigrationInterface {
  name = 'ThreadTurnRequests1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "thread_turns" ADD COLUMN "request_count" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "thread_turns" DROP COLUMN "request_count"`);
  }
}
