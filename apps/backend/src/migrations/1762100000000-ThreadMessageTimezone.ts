import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The IANA timezone a person's client reported when they wrote a message.
 * Read by the threads agent's `get_time` tool. Existing rows stay null.
 */
export class ThreadMessageTimezone1762100000000 implements MigrationInterface {
  name = 'ThreadMessageTimezone1762100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "thread_messages" ADD COLUMN "timezone" text NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "thread_messages" DROP COLUMN "timezone"`);
  }
}
