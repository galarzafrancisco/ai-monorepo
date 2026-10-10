import { MigrationInterface, QueryRunner } from 'typeorm';

export class ThreadChatHistory1791580000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "thread_chat_history" (
      "thread_id" uuid PRIMARY KEY REFERENCES "threads"("id") ON DELETE CASCADE,
      "messages" jsonb NOT NULL
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "thread_chat_history"');
  }
}
