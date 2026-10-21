import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits the quick_tasks job into user_small_tasks (calls a person started,
 * which may run on that person's own plan) and system_small_tasks (calls
 * nobody started, which need a provider with an API key).
 *
 * An existing quick_tasks selection carries over to both jobs, except that a
 * provider running on a person's own plan only carries over to user small
 * tasks; system small tasks then follow the conversation model or show as
 * needing setup. The quick_tasks row is removed.
 */
export class SplitSmallTasksSelection1761700000000 implements MigrationInterface {
  name = 'SplitSmallTasksSelection1761700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "ai_model_selections" ("job", "ai_provider_id", "model_id")
       SELECT 'user_small_tasks', s."ai_provider_id", s."model_id"
         FROM "ai_model_selections" s
        WHERE s."job" = 'quick_tasks'
       ON CONFLICT ("job") DO NOTHING`,
    );
    await queryRunner.query(
      `INSERT INTO "ai_model_selections" ("job", "ai_provider_id", "model_id")
       SELECT 'system_small_tasks', s."ai_provider_id", s."model_id"
         FROM "ai_model_selections" s
         JOIN "ai_providers" p ON p."id" = s."ai_provider_id"
        WHERE s."job" = 'quick_tasks' AND p."type" <> 'chatgpt_subscription'
       ON CONFLICT ("job") DO NOTHING`,
    );
    await queryRunner.query(`DELETE FROM "ai_model_selections" WHERE "job" = 'quick_tasks'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore quick_tasks from the user small tasks selection, whatever its
    // provider (up() kept a personal-plan selection there, so rollback keeps
    // it too). Use system small tasks only when user small tasks has none.
    await queryRunner.query(
      `INSERT INTO "ai_model_selections" ("job", "ai_provider_id", "model_id")
       SELECT 'quick_tasks', s."ai_provider_id", s."model_id"
         FROM "ai_model_selections" s
        WHERE s."job" IN ('user_small_tasks', 'system_small_tasks')
        ORDER BY CASE s."job" WHEN 'user_small_tasks' THEN 0 ELSE 1 END
        LIMIT 1
       ON CONFLICT ("job") DO NOTHING`,
    );
    await queryRunner.query(
      `DELETE FROM "ai_model_selections" WHERE "job" IN ('user_small_tasks', 'system_small_tasks')`,
    );
  }
}
