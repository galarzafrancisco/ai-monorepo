import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a person connect their own account to an AI provider (Sign in with
 * ChatGPT). Adds the connections, the sign-ins in progress, and an
 * installation id on providers of that kind. Existing providers are unchanged.
 */
export class AiProviderConnections1761600000000 implements MigrationInterface {
  name = 'AiProviderConnections1761600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_providers" ADD "host_id" text`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_providers_chatgpt_subscription" ON "ai_providers" ("type") WHERE "type" = 'chatgpt_subscription' AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "ai_provider_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ai_provider_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" text NOT NULL,
        "external_client_id" text,
        "external_issuer" text,
        "external_subject" text,
        "external_email" text,
        "granted_scopes" text,
        "credentials" text,
        "access_token_expires_at" TIMESTAMP WITH TIME ZONE,
        "automated_turns_allowed_at" TIMESTAMP WITH TIME ZONE,
        "last_error_code" text,
        "last_error_at" TIMESTAMP WITH TIME ZONE,
        "row_version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_provider_connections" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_provider_connections_ai_provider" FOREIGN KEY ("ai_provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_provider_connections_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_provider_connections_provider_user" ON "ai_provider_connections" ("ai_provider_id", "user_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "ai_provider_authorization_attempts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ai_provider_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "state_hash" text NOT NULL,
        "nonce" text NOT NULL,
        "code_verifier" text NOT NULL,
        "redirect_uri" text NOT NULL,
        "client_id" text NOT NULL,
        "is_registration" boolean NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_provider_authorization_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_provider_authorization_attempts_ai_provider" FOREIGN KEY ("ai_provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_provider_authorization_attempts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_provider_authorization_attempts_state" ON "ai_provider_authorization_attempts" ("state_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_provider_authorization_attempts"`);
    await queryRunner.query(`DROP TABLE "ai_provider_connections"`);
    // Providers of this kind cannot work without the tables above.
    await queryRunner.query(
      `DELETE FROM "ai_model_selections" WHERE "ai_provider_id" IN (SELECT "id" FROM "ai_providers" WHERE "type" = 'chatgpt_subscription')`,
    );
    await queryRunner.query(
      `UPDATE "threads" SET "ai_provider_id" = NULL, "model_id" = NULL WHERE "ai_provider_id" IN (SELECT "id" FROM "ai_providers" WHERE "type" = 'chatgpt_subscription')`,
    );
    await queryRunner.query(
      `DELETE FROM "ai_providers" WHERE "type" = 'chatgpt_subscription'`,
    );
    await queryRunner.query(
      `DROP INDEX "UQ_ai_providers_chatgpt_subscription"`,
    );
    await queryRunner.query(`ALTER TABLE "ai_providers" DROP COLUMN "host_id"`);
  }
}
