import { MigrationInterface, QueryRunner } from 'typeorm';

export class ThreadAgentMessages1760200000000 implements MigrationInterface {
  name = 'ThreadAgentMessages1760200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "thread_agent_messages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "thread_id" uuid NOT NULL, "parent_id" uuid, "turn_id" uuid, "role" text NOT NULL, "kind" text NOT NULL DEFAULT 'message', "source" text NOT NULL, "message" jsonb NOT NULL, "format_version" integer NOT NULL DEFAULT 1, "provider_type" text, "model_id" text, "usage" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_thread_agent_messages" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_thread_agent_messages_thread_created" ON "thread_agent_messages" ("thread_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_thread_agent_messages_parent" ON "thread_agent_messages" ("parent_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_agent_messages" ADD CONSTRAINT "FK_thread_agent_messages_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_agent_messages" ADD CONSTRAINT "FK_thread_agent_messages_parent" FOREIGN KEY ("parent_id") REFERENCES "thread_agent_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "thread_turns" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "thread_id" uuid NOT NULL, "status" text NOT NULL DEFAULT 'running', "error" text, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "heartbeat_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_thread_turns" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_thread_turns_running_thread" ON "thread_turns" ("thread_id") WHERE "status" = 'running'`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_turns" ADD CONSTRAINT "FK_thread_turns_thread" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "threads" ADD "head_agent_message_id" uuid, ADD "chat_provider_id" uuid, ADD "model_id" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_messages" ADD "agent_message_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_messages" ADD CONSTRAINT "FK_thread_messages_agent_message" FOREIGN KEY ("agent_message_id") REFERENCES "thread_agent_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "thread_messages" DROP CONSTRAINT "FK_thread_messages_agent_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_messages" DROP COLUMN "agent_message_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" DROP COLUMN "model_id", DROP COLUMN "chat_provider_id", DROP COLUMN "head_agent_message_id"`,
    );
    await queryRunner.query(`DROP TABLE "thread_turns"`);
    await queryRunner.query(`DROP TABLE "thread_agent_messages"`);
  }
}
