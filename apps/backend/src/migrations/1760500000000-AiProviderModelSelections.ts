import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits "which vendor" from "which model". Chat providers become AI providers
 * that hold only credentials and endpoints; ai_model_selections says which
 * provider and model each job uses.
 *
 * The previously active provider and its model become the conversation
 * selection. Threads stop storing a copy of the global selection.
 */
export class AiProviderModelSelections1760500000000 implements MigrationInterface {
  name = 'AiProviderModelSelections1760500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_providers" RENAME TO "ai_providers"`);
    await queryRunner.query(
      `ALTER TABLE "threads" RENAME COLUMN "chat_provider_id" TO "ai_provider_id"`,
    );

    await queryRunner.query(
      `CREATE TABLE "ai_model_selections" (
        "job" text NOT NULL,
        "ai_provider_id" uuid NOT NULL,
        "model_id" text NOT NULL,
        "row_version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_model_selections" PRIMARY KEY ("job"),
        CONSTRAINT "FK_ai_model_selections_ai_provider" FOREIGN KEY ("ai_provider_id") REFERENCES "ai_providers"("id")
      )`,
    );

    // A provider without a model used the taico agent's model (OpenAI only), then a built-in default.
    await queryRunner.query(
      `INSERT INTO "ai_model_selections" ("job", "ai_provider_id", "model_id")
       SELECT 'conversation', p."id", m."model_id"
         FROM "ai_providers" p
        CROSS JOIN LATERAL (
          SELECT COALESCE(
            NULLIF(p."model_id", ''),
            CASE WHEN p."type" = 'openai'
                 THEN (SELECT NULLIF(a."model_id", '') FROM "agents" a JOIN "actors" x ON x."id" = a."actor_id" WHERE x."slug" = 'taico' LIMIT 1)
            END,
            CASE p."type"
              WHEN 'openai' THEN 'gpt-5.4'
              WHEN 'anthropic' THEN 'claude-opus-5-5'
              WHEN 'google' THEN 'gemini-3.6-flash'
              WHEN 'google_vertex' THEN 'gemini-3.6-flash'
            END
          ) AS "model_id"
        ) m
        WHERE p."is_active" = true AND p."deleted_at" IS NULL AND m."model_id" IS NOT NULL
        ORDER BY p."updated_at" DESC
        LIMIT 1`,
    );

    await queryRunner.query(`UPDATE "threads" SET "ai_provider_id" = NULL, "model_id" = NULL`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_chat_providers_is_active"`);
    await queryRunner.query(
      `ALTER TABLE "ai_providers" DROP COLUMN "model_id", DROP COLUMN "is_active"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_providers" ADD "model_id" text, ADD "is_active" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "ai_providers" p
          SET "is_active" = true, "model_id" = s."model_id"
         FROM "ai_model_selections" s
        WHERE s."job" = 'conversation' AND s."ai_provider_id" = p."id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_providers_is_active" ON "ai_providers" ("is_active") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(`DROP TABLE "ai_model_selections"`);
    await queryRunner.query(
      `ALTER TABLE "threads" RENAME COLUMN "ai_provider_id" TO "chat_provider_id"`,
    );
    await queryRunner.query(`ALTER TABLE "ai_providers" RENAME TO "chat_providers"`);
  }
}
