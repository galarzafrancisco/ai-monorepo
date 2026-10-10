import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppendOnlyThreadChatHistory1791629000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Preserve history from installations that already ran the initial SDK
    // migration. Build alongside the old table to avoid primary-index conflicts.
    await queryRunner.query(`CREATE TABLE "thread_chat_history_messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "thread_id" uuid NOT NULL REFERENCES "threads"("id") ON DELETE CASCADE,
      "message" jsonb NOT NULL,
      "sequence" bigserial NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`INSERT INTO "thread_chat_history_messages" ("thread_id", "message")
      SELECT history."thread_id", entry.message
      FROM "thread_chat_history" history
      CROSS JOIN LATERAL jsonb_array_elements(history."messages") WITH ORDINALITY AS entry(message, position)
      ORDER BY history."thread_id", entry.position`);
    await queryRunner.query('DROP TABLE "thread_chat_history"');
    await queryRunner.query('ALTER TABLE "thread_chat_history_messages" RENAME TO "thread_chat_history"');
    await queryRunner.query(`CREATE INDEX "IDX_thread_chat_history_thread_sequence"
      ON "thread_chat_history" ("thread_id", "sequence")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "thread_chat_history_arrays" (
      "thread_id" uuid PRIMARY KEY REFERENCES "threads"("id") ON DELETE CASCADE,
      "messages" jsonb NOT NULL
    )`);
    await queryRunner.query(`INSERT INTO "thread_chat_history_arrays" ("thread_id", "messages")
      SELECT "thread_id", jsonb_agg("message" ORDER BY "sequence")
      FROM "thread_chat_history" GROUP BY "thread_id"`);
    await queryRunner.query('DROP TABLE "thread_chat_history"');
    await queryRunner.query('ALTER TABLE "thread_chat_history_arrays" RENAME TO "thread_chat_history"');
  }
}
