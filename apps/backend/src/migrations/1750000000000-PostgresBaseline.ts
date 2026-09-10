import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostgresBaseline1750000000000 implements MigrationInterface {
  name = 'PostgresBaseline1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(
      `CREATE TABLE "registered_clients" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "client_id" text NOT NULL, "client_secret" text, "client_name" text NOT NULL, "redirect_uris" text NOT NULL, "grant_types" text NOT NULL, "token_endpoint_auth_method" text NOT NULL, "scopes" text, "contacts" text, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_0ef710851de2056ed5b213a7cc9" UNIQUE ("client_id"), CONSTRAINT "PK_e628d45dc972e2be3bdf54fbc68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "oauth_client_id" text NOT NULL, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "worker_version" text, "harnesses" text NOT NULL DEFAULT '[]', "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_504178c0ec7be818c522c0f01af" UNIQUE ("oauth_client_id"), CONSTRAINT "PK_e950c9aba3bd84a4f193058d838" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "actor_id" uuid NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "role" character varying NOT NULL DEFAULT 'standard', "onboarding_display_mode" character varying NOT NULL DEFAULT 'FULL_PAGE', "rowVersion" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_0c17e643b069470055be07d69ed" UNIQUE ("actor_id"), CONSTRAINT "REL_0c17e643b069470055be07d69e" UNIQUE ("actor_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mcp_connections" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "serverId" uuid NOT NULL, "friendlyName" character varying(255) NOT NULL, "providedId" character varying(255), "clientId" character varying(500) NOT NULL, "clientSecret" text NOT NULL, "authorizeUrl" text NOT NULL, "tokenUrl" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_da19f3d0d9d03f4918f7960b77a" UNIQUE ("providedId"), CONSTRAINT "PK_23993c4be057f50544ba18f0ff0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mcp_scope_mappings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "scopeId" character varying(255) NOT NULL, "serverId" uuid NOT NULL, "connectionId" uuid NOT NULL, "downstreamScope" character varying(255) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_mcp_scope_mapping" UNIQUE ("scopeId", "serverId", "connectionId", "downstreamScope"), CONSTRAINT "PK_746ddbb6fc7524f4fa8048d908a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_tool_permission_scopes" ("agent_actor_id" uuid NOT NULL, "server_id" uuid NOT NULL, "scope_id" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3b97ecdf578e899e593c8e07be2" PRIMARY KEY ("agent_actor_id", "server_id", "scope_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mcp_scopes" ("id" character varying(255) NOT NULL, "serverId" uuid NOT NULL, "description" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_acc013288973247a1f42288667a" PRIMARY KEY ("id", "serverId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mcp_servers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "providedId" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL, "type" text NOT NULL DEFAULT 'http', "url" character varying(2048), "cmd" character varying(1024), "args" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c781b3dc7cb2a5d19460b71914d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_tool_permissions" ("agent_actor_id" uuid NOT NULL, "server_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c00e63fb1c0daa87887f3b74ca6" PRIMARY KEY ("agent_actor_id", "server_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_id" uuid NOT NULL, "type" text NOT NULL DEFAULT 'claude', "description" text, "system_prompt" text NOT NULL, "provider_id" text, "model_id" text, "status_triggers" text NOT NULL DEFAULT '', "tag_triggers" text NOT NULL DEFAULT '', "allowed_tools" text NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "concurrency_limit" integer, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_2c4c2595e6f8699f2b26b5e7589" UNIQUE ("actor_id"), CONSTRAINT "REL_2c4c2595e6f8699f2b26b5e758" UNIQUE ("actor_id"), CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "actors" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "type" text NOT NULL, "slug" text NOT NULL, "display_name" text NOT NULL, "avatar_url" text, "introduction" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d728e8d8a38480121d06532aabf" UNIQUE ("slug"), CONSTRAINT "PK_d8608598c2c4f907a78de2ae461" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "commenter_actor_id" uuid, "content" text NOT NULL, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "task_id" uuid, CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "artefacts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "link" text NOT NULL, "task_id" uuid NOT NULL, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_8cdd23eb9884b8122591613ca3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_input_requests" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "task_id" uuid NOT NULL, "asked_by_actor_id" uuid NOT NULL, "assigned_to_actor_id" uuid NOT NULL, "question" text NOT NULL, "answer" text, "resolved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a742e2160ec8f3f79f19c85caec" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "context_blocks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" text NOT NULL, "content" text NOT NULL, "parent_id" uuid, "order" integer NOT NULL DEFAULT '0', "created_by_actor_id" uuid NOT NULL, "assignee_actor_id" uuid, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5072b3dfa3d6102fb779b6c8175" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a9ba3074228102f4d699f5364f" ON "context_blocks" ("parent_id", "order") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "color" text, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "description" text NOT NULL, "status" text NOT NULL DEFAULT 'NOT_STARTED', "assignee_actor_id" uuid, "session_id" text, "created_by_actor_id" uuid NOT NULL, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "thread_messages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "thread_id" uuid NOT NULL, "content" text NOT NULL, "created_by_actor_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_362f852009f5fceefddab0fbe81" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "threads" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" text NOT NULL, "chat_session_id" text, "created_by_actor_id" uuid NOT NULL, "parent_task_id" uuid, "state_context_block_id" uuid NOT NULL, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d8a74804c34fc3900502cd27275" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_blueprints" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "description" text NOT NULL, "assignee_actor_id" uuid, "created_by_actor_id" uuid NOT NULL, "depends_on_ids" text, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_826f673c651065c6226821f549a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "scheduled_tasks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "task_blueprint_id" uuid NOT NULL, "cron_expression" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "last_run_at" TIMESTAMP WITH TIME ZONE, "next_run_at" TIMESTAMP WITH TIME ZONE NOT NULL, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_abc9348e8ae95b59b11a982ea87" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scheduled_tasks_task_blueprint_id" ON "scheduled_tasks" ("task_blueprint_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scheduled_tasks_enabled_next_run_at" ON "scheduled_tasks" ("enabled", "next_run_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "secrets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "description" text, "encrypted_value" text NOT NULL, "created_by_actor_id" uuid NOT NULL, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d4ff48ddba1883d4dc142b9c697" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tag_usage" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "tag_id" uuid NOT NULL, "usage_count" integer NOT NULL DEFAULT '0', "last_used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d76511ebb1fe17ed68b75e7cc56" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fc603902944def35770f762c0e" ON "tag_usage" ("tag_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "tagId" uuid NOT NULL, "slug" text NOT NULL, "description" text, "repoUrl" text, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_30fa6513ff893536087fece24e4" UNIQUE ("tagId"), CONSTRAINT "UQ_96e045ab8b0271e5f5a91eae1ee" UNIQUE ("slug"), CONSTRAINT "REL_30fa6513ff893536087fece24e" UNIQUE ("tagId"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_providers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "type" text NOT NULL, "secret_id" uuid, "is_active" boolean NOT NULL DEFAULT false, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f48a8be4aa21d7499c54c5623a7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_runs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_id" uuid NOT NULL, "parent_task_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "started_at" TIMESTAMP WITH TIME ZONE, "ended_at" TIMESTAMP WITH TIME ZONE, "last_ping" TIMESTAMP WITH TIME ZONE, "task_execution_id" uuid, CONSTRAINT "PK_442f7e0ec4ae860cf17edc57825" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_agent_runs_task_execution_id" ON "agent_runs" ("task_execution_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "execution_stats" ("execution_id" uuid NOT NULL, "harness" text, "provider_id" text, "model_id" text, "worker_version" text, "input_tokens" integer, "output_tokens" integer, "total_tokens" integer, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3d4279451cf767ec4ef4a7e4282" PRIMARY KEY ("execution_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_execution_queue" ("task_id" uuid NOT NULL, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e6293cc4ad257649be5e6f58598" PRIMARY KEY ("task_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_execution_history" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "task_id" uuid NOT NULL, "claimed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "transitioned_at" TIMESTAMP WITH TIME ZONE NOT NULL, "agent_actor_id" uuid NOT NULL, "worker_client_id" text NOT NULL, "runner_session_id" text, "tool_call_count" integer NOT NULL DEFAULT '0', "status" text NOT NULL, "error_code" text, "error_message" text, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_2504983ce9b30639fd85ae36623" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "active_task_executions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "task_id" uuid NOT NULL, "claimed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "task_status_before_claim" text NOT NULL, "task_tags_before_claim" text NOT NULL, "task_assignee_actor_id_before_claim" uuid, "agent_actor_id" uuid NOT NULL, "worker_client_id" text NOT NULL, "last_heartbeat_at" TIMESTAMP WITH TIME ZONE, "runner_session_id" text, "tool_call_count" integer NOT NULL DEFAULT '0', "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_ff4cf561fb305efc1fe12c52d7d" UNIQUE ("task_id"), CONSTRAINT "PK_6549be8f109c79998e5f0183d09" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "connection_authorization_flows" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "authorization_journey_id" uuid NOT NULL, "mcp_connection_id" uuid NOT NULL, "state" character varying(255), "authorization_code" character varying(500), "access_token" text, "refresh_token" text, "token_expires_at" TIMESTAMP WITH TIME ZONE, "status" character varying(50) NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_92f8522b1967d77a4363c3b946f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "authorization_journeys" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "status" text NOT NULL DEFAULT 'not_started', "actor_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6e1bfab15b537365041a9341fd1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mcp_authorization_flows" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "authorization_journey_id" uuid NOT NULL, "server_id" uuid NOT NULL, "client_id" uuid NOT NULL, "status" text NOT NULL DEFAULT 'CLIENT_NOT_REGISTERED', "code_challenge" text, "code_challenge_method" character varying(10), "state" text, "redirect_uri" text, "scopes" text, "resource" text, "authorization_code" text, "authorization_code_expires_at" TIMESTAMP WITH TIME ZONE, "authorization_code_used" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_e059c1afc29350cf077fec4c41" UNIQUE ("authorization_journey_id"), CONSTRAINT "REL_0bf6704cedff2e876c78f69239" UNIQUE ("client_id"), CONSTRAINT "PK_f777a205c2736591cbea8d00652" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mcp_refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "mcp_authorization_flow_id" uuid NOT NULL, "token_hash" text NOT NULL, "client_id" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0a56ff19b7fe48d4fa2ac7fd80c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "issued_access_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "subject_actor_id" uuid NOT NULL, "issued_by_actor_id" uuid NOT NULL, "jti" text NOT NULL, "name" text NOT NULL, "scopes" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_ba180406113fbf46571e68f3f42" UNIQUE ("jti"), CONSTRAINT "PK_38d85c5540f4a7eb8bf0f0a383c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "jwks_keys" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "kid" text NOT NULL, "public_key_pem" text NOT NULL, "private_key_pem" text NOT NULL, "algorithm" text NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "row_version" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_e3ce852f6df1aadba3556a4a25c" UNIQUE ("kid"), CONSTRAINT "PK_f34118b5ad5b54a309e5fd0fdd2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "context_block_tags" ("block_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_0d76072c9dcfe60511bfbf32250" PRIMARY KEY ("block_id", "tag_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8eee5fc7e05f49c69e84f4cd38" ON "context_block_tags" ("block_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8704e0fe5627b9514b24d898f7" ON "context_block_tags" ("tag_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "task_dependencies" ("task_id" uuid NOT NULL, "depends_on_task_id" uuid NOT NULL, CONSTRAINT "PK_34abffd156d4d10466f5f254ef2" PRIMARY KEY ("task_id", "depends_on_task_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ae6688b1bd90fffe857f4cb70" ON "task_dependencies" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_26dedda08faccdb95aff99e112" ON "task_dependencies" ("depends_on_task_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "task_tags" ("task_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_a7354e3c3f630636f6e4a29694a" PRIMARY KEY ("task_id", "tag_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_70515bc464901781ac60b82a1e" ON "task_tags" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f883135d033e1541f6a81972e7" ON "task_tags" ("tag_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "thread_tasks" ("thread_id" uuid NOT NULL, "task_id" uuid NOT NULL, CONSTRAINT "PK_9ef1b08e2914954da7470f44ee3" PRIMARY KEY ("thread_id", "task_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9dfa54dc69d0b1b215d36e4fcb" ON "thread_tasks" ("thread_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_27940e313cd1b50301ca7b9927" ON "thread_tasks" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "thread_context_blocks" ("thread_id" uuid NOT NULL, "context_block_id" uuid NOT NULL, CONSTRAINT "PK_b0db86740ce7697abec9e6a99df" PRIMARY KEY ("thread_id", "context_block_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0ac4c88dcd93e8152d743bcd8" ON "thread_context_blocks" ("thread_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ee41ccd22caec2f434d2fa180" ON "thread_context_blocks" ("context_block_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "thread_tags" ("thread_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_7f989951c8fceb626a32f61805d" PRIMARY KEY ("thread_id", "tag_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3b7d48bd25da9d3618981fdc3a" ON "thread_tags" ("thread_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ee437d566a7d008da12d2424c6" ON "thread_tags" ("tag_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "thread_participants" ("thread_id" uuid NOT NULL, "actor_id" uuid NOT NULL, CONSTRAINT "PK_70b36ca524cfccce3936653aa0e" PRIMARY KEY ("thread_id", "actor_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c0b642fb1e69a2d51ad4a42763" ON "thread_participants" ("thread_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88073a6748e95733b098e74996" ON "thread_participants" ("actor_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "task_blueprint_tags" ("task_blueprint_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_8ef4e39a26f9b3b5ead6ddca8e7" PRIMARY KEY ("task_blueprint_id", "tag_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2bd456852196e805b98e962bc" ON "task_blueprint_tags" ("task_blueprint_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d7aba355071665af6488f130a7" ON "task_blueprint_tags" ("tag_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workers" ADD CONSTRAINT "FK_504178c0ec7be818c522c0f01af" FOREIGN KEY ("oauth_client_id") REFERENCES "registered_clients"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_0c17e643b069470055be07d69ed" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_connections" ADD CONSTRAINT "FK_ec0a65330c7c528d7ee7cd09b4a" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_scope_mappings" ADD CONSTRAINT "FK_2b56cc692e2f3b451195876c4e9" FOREIGN KEY ("scopeId", "serverId") REFERENCES "mcp_scopes"("id","serverId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_scope_mappings" ADD CONSTRAINT "FK_c376dcb7f9a05b39c08d63622bc" FOREIGN KEY ("connectionId") REFERENCES "mcp_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_permission_scopes" ADD CONSTRAINT "FK_fea954ca4ca5815942a26c5ad53" FOREIGN KEY ("agent_actor_id", "server_id") REFERENCES "agent_tool_permissions"("agent_actor_id","server_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_permission_scopes" ADD CONSTRAINT "FK_71546cc2626cf18017c63ff518f" FOREIGN KEY ("scope_id", "server_id") REFERENCES "mcp_scopes"("id","serverId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_scopes" ADD CONSTRAINT "FK_68cecda9c8d84c8c61f229a4be2" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_permissions" ADD CONSTRAINT "FK_c9e747b35e1b9f6a9ac109685ad" FOREIGN KEY ("agent_actor_id") REFERENCES "agents"("actor_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_permissions" ADD CONSTRAINT "FK_f1eb1e26820d24a12c626b81e91" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD CONSTRAINT "FK_2c4c2595e6f8699f2b26b5e7589" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_bbfbee2b1b4f9f1f7de4c02654c" FOREIGN KEY ("commenter_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_18c2493067c11f44efb35ca0e03" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "artefacts" ADD CONSTRAINT "FK_7841ac39f494f914d5200cb94be" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_input_requests" ADD CONSTRAINT "FK_de2e79dbc1588bfc1e6416329f8" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_input_requests" ADD CONSTRAINT "FK_12bbab9cd739978a4ac7a318b5b" FOREIGN KEY ("asked_by_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_input_requests" ADD CONSTRAINT "FK_99c0a77a070c5ff4eb339107d00" FOREIGN KEY ("assigned_to_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_blocks" ADD CONSTRAINT "FK_1700363b5a5db27b0f2ea2cc39d" FOREIGN KEY ("created_by_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_blocks" ADD CONSTRAINT "FK_b34d08eeab998b83e5ca84d7b7b" FOREIGN KEY ("assignee_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_blocks" ADD CONSTRAINT "FK_938da9a0857d1b418dcc33e7326" FOREIGN KEY ("parent_id") REFERENCES "context_blocks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_733d1181d78ed254ea08e8683c4" FOREIGN KEY ("assignee_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_a3e0f9b54499d948c2d62c8ef03" FOREIGN KEY ("created_by_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_messages" ADD CONSTRAINT "FK_c6bc073e77f201aa2fdbaa1688e" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_messages" ADD CONSTRAINT "FK_50433df7361de1e6aaa5ce135f0" FOREIGN KEY ("created_by_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" ADD CONSTRAINT "FK_88952da3cfbf9e9618e7bb36555" FOREIGN KEY ("created_by_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" ADD CONSTRAINT "FK_f93fd3ebb839bcfec39507a7a08" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" ADD CONSTRAINT "FK_108b53483c683c9984d2a2c50e6" FOREIGN KEY ("state_context_block_id") REFERENCES "context_blocks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_blueprints" ADD CONSTRAINT "FK_7c590d2fc49e749264538ceb4bb" FOREIGN KEY ("assignee_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_blueprints" ADD CONSTRAINT "FK_04d8ca9e76a6128b419f3e4ead4" FOREIGN KEY ("created_by_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "FK_e0ed072463cead4e3c32ee96a70" FOREIGN KEY ("task_blueprint_id") REFERENCES "task_blueprints"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "secrets" ADD CONSTRAINT "FK_b90f89051d9de67b62a3c412e04" FOREIGN KEY ("created_by_actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_usage" ADD CONSTRAINT "FK_fc603902944def35770f762c0e8" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_30fa6513ff893536087fece24e4" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_providers" ADD CONSTRAINT "FK_ce21fdd216a3dc4449048d98701" FOREIGN KEY ("secret_id") REFERENCES "secrets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ADD CONSTRAINT "FK_76579c6cb0dd9963517972ff181" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ADD CONSTRAINT "FK_696fd2a86092b418b8d9f4b98a1" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_execution_queue" ADD CONSTRAINT "FK_e6293cc4ad257649be5e6f58598" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_execution_history" ADD CONSTRAINT "FK_984e814ae64967b7b44c489f31a" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_execution_history" ADD CONSTRAINT "FK_7142473429261e167efdb3cc233" FOREIGN KEY ("agent_actor_id") REFERENCES "agents"("actor_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_task_executions" ADD CONSTRAINT "FK_ff4cf561fb305efc1fe12c52d7d" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_task_executions" ADD CONSTRAINT "FK_76b62d7c79a8d94670416e9f431" FOREIGN KEY ("agent_actor_id") REFERENCES "agents"("actor_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "connection_authorization_flows" ADD CONSTRAINT "FK_0202c0a6cdc97d768d2f30bd98e" FOREIGN KEY ("authorization_journey_id") REFERENCES "authorization_journeys"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "connection_authorization_flows" ADD CONSTRAINT "FK_9733b428ec183d2f631fe084a19" FOREIGN KEY ("mcp_connection_id") REFERENCES "mcp_connections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "authorization_journeys" ADD CONSTRAINT "FK_52f76ac34609751f50ec32e01b0" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" ADD CONSTRAINT "FK_e059c1afc29350cf077fec4c41b" FOREIGN KEY ("authorization_journey_id") REFERENCES "authorization_journeys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" ADD CONSTRAINT "FK_a16cb7e1605a1d6347ba1f40ad3" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" ADD CONSTRAINT "FK_0bf6704cedff2e876c78f692398" FOREIGN KEY ("client_id") REFERENCES "registered_clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_refresh_tokens" ADD CONSTRAINT "FK_20955b8ef7f0e27ee2198a80015" FOREIGN KEY ("mcp_authorization_flow_id") REFERENCES "mcp_authorization_flows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issued_access_tokens" ADD CONSTRAINT "FK_d9204aec1e09d08d06011993cd4" FOREIGN KEY ("subject_actor_id") REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issued_access_tokens" ADD CONSTRAINT "FK_20f8dee70027015cf098a9cbf93" FOREIGN KEY ("issued_by_actor_id") REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_block_tags" ADD CONSTRAINT "FK_8eee5fc7e05f49c69e84f4cd384" FOREIGN KEY ("block_id") REFERENCES "context_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_block_tags" ADD CONSTRAINT "FK_8704e0fe5627b9514b24d898f7a" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_1ae6688b1bd90fffe857f4cb707" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_26dedda08faccdb95aff99e112e" FOREIGN KEY ("depends_on_task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_tags" ADD CONSTRAINT "FK_70515bc464901781ac60b82a1ea" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_tags" ADD CONSTRAINT "FK_f883135d033e1541f6a81972e7d" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_tasks" ADD CONSTRAINT "FK_9dfa54dc69d0b1b215d36e4fcb7" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_tasks" ADD CONSTRAINT "FK_27940e313cd1b50301ca7b9927d" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_context_blocks" ADD CONSTRAINT "FK_b0ac4c88dcd93e8152d743bcd87" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_context_blocks" ADD CONSTRAINT "FK_7ee41ccd22caec2f434d2fa1802" FOREIGN KEY ("context_block_id") REFERENCES "context_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_tags" ADD CONSTRAINT "FK_3b7d48bd25da9d3618981fdc3ac" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_tags" ADD CONSTRAINT "FK_ee437d566a7d008da12d2424c64" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_participants" ADD CONSTRAINT "FK_c0b642fb1e69a2d51ad4a427635" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_participants" ADD CONSTRAINT "FK_88073a6748e95733b098e74996a" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_blueprint_tags" ADD CONSTRAINT "FK_b2bd456852196e805b98e962bc3" FOREIGN KEY ("task_blueprint_id") REFERENCES "task_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_blueprint_tags" ADD CONSTRAINT "FK_d7aba355071665af6488f130a7c" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    // The one-time SQLite importer loads a graph containing cycles and
    // self-references. Integrity is still checked atomically at commit.
    await queryRunner.query(`DO $$
          DECLARE constraint_row record;
          BEGIN
            FOR constraint_row IN
              SELECT n.nspname AS schema_name, c.relname AS table_name, p.conname AS constraint_name
              FROM pg_constraint p
              JOIN pg_class c ON c.oid = p.conrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE p.contype = 'f' AND n.nspname = 'public'
            LOOP
              EXECUTE format(
                'ALTER TABLE %I.%I ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',
                constraint_row.schema_name,
                constraint_row.table_name,
                constraint_row.constraint_name
              );
            END LOOP;
          END $$`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tags_name_ci" ON "tags" (lower("name"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_secrets_name" ON "secrets" ("name") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_mcp_servers_provided_id_active" ON "mcp_servers" ("providedId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_threads_parent_task_id_non_null" ON "threads" ("parent_task_id") WHERE "parent_task_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_providers_is_active" ON "chat_providers" ("is_active") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "actors" ADD CONSTRAINT "chk_actors_type" CHECK ("type" IN ('human', 'agent'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD CONSTRAINT "chk_agents_type" CHECK ("type" IN ('claude', 'codex', 'opencode', 'adk', 'githubcopilot', 'other'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "chk_tasks_status" CHECK ("status" IN ('NOT_STARTED', 'IN_PROGRESS', 'FOR_REVIEW', 'DONE'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_task_executions" ADD CONSTRAINT "chk_active_execution_task_status" CHECK ("task_status_before_claim" IN ('NOT_STARTED', 'IN_PROGRESS', 'FOR_REVIEW', 'DONE'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_execution_history" ADD CONSTRAINT "chk_execution_history_status" CHECK ("status" IN ('SUCCEEDED', 'FAILED', 'STALE', 'CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_execution_history" ADD CONSTRAINT "chk_execution_history_error_code" CHECK ("error_code" IS NULL OR "error_code" IN ('OUT_OF_QUOTA', 'INTERRUPTED', 'UNKNOWN'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" ADD CONSTRAINT "chk_registered_client_auth_method" CHECK ("token_endpoint_auth_method" IN ('none', 'client_secret_basic'))`,
    );
    await queryRunner.query(`CREATE TABLE "adk_sessions" (
          "app_name" text NOT NULL,
          "user_id" text NOT NULL,
          "session_id" text NOT NULL,
          "state_json" jsonb NOT NULL,
          "last_update_time" bigint NOT NULL,
          PRIMARY KEY ("app_name", "user_id", "session_id")
        )`);
    await queryRunner.query(`CREATE TABLE "adk_events" (
          "sequence" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          "app_name" text NOT NULL,
          "user_id" text NOT NULL,
          "session_id" text NOT NULL,
          "event_id" text NOT NULL,
          "timestamp" bigint NOT NULL,
          "event_json" jsonb NOT NULL,
          CONSTRAINT "fk_adk_events_session" FOREIGN KEY ("app_name", "user_id", "session_id")
            REFERENCES "adk_sessions" ("app_name", "user_id", "session_id") ON DELETE CASCADE
        )`);
    await queryRunner.query(
      `CREATE INDEX "idx_adk_events_session_sequence" ON "adk_events" ("app_name", "user_id", "session_id", "sequence")`,
    );
    await queryRunner.query(`CREATE TABLE "adk_app_state" (
          "app_name" text NOT NULL,
          "state_key" text NOT NULL,
          "value_json" jsonb NOT NULL,
          PRIMARY KEY ("app_name", "state_key")
        )`);
    await queryRunner.query(`CREATE TABLE "adk_user_state" (
          "app_name" text NOT NULL,
          "user_id" text NOT NULL,
          "state_key" text NOT NULL,
          "value_json" jsonb NOT NULL,
          PRIMARY KEY ("app_name", "user_id", "state_key")
        )`);
    await queryRunner.query(`CREATE SCHEMA "migration_archive"`);
    await queryRunner.query(`CREATE TABLE "migration_archive"."rows" (
          "source_database" text NOT NULL,
          "source_table" text NOT NULL,
          "source_key" text,
          "reason" text NOT NULL,
          "row_data" jsonb NOT NULL,
          "archived_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA "migration_archive" CASCADE`);
    await queryRunner.query(`DROP TABLE "adk_user_state"`);
    await queryRunner.query(`DROP TABLE "adk_app_state"`);
    await queryRunner.query(`DROP TABLE "adk_events"`);
    await queryRunner.query(`DROP TABLE "adk_sessions"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_chat_providers_is_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_threads_parent_task_id_non_null"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_mcp_servers_provided_id_active"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_secrets_name"`);
    await queryRunner.query(`DROP INDEX "public"."uq_tags_name_ci"`);
    await queryRunner.query(
      `ALTER TABLE "task_blueprint_tags" DROP CONSTRAINT "FK_d7aba355071665af6488f130a7c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_blueprint_tags" DROP CONSTRAINT "FK_b2bd456852196e805b98e962bc3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_participants" DROP CONSTRAINT "FK_88073a6748e95733b098e74996a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_participants" DROP CONSTRAINT "FK_c0b642fb1e69a2d51ad4a427635"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_tags" DROP CONSTRAINT "FK_ee437d566a7d008da12d2424c64"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_tags" DROP CONSTRAINT "FK_3b7d48bd25da9d3618981fdc3ac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_context_blocks" DROP CONSTRAINT "FK_7ee41ccd22caec2f434d2fa1802"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_context_blocks" DROP CONSTRAINT "FK_b0ac4c88dcd93e8152d743bcd87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_tasks" DROP CONSTRAINT "FK_27940e313cd1b50301ca7b9927d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_tasks" DROP CONSTRAINT "FK_9dfa54dc69d0b1b215d36e4fcb7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_tags" DROP CONSTRAINT "FK_f883135d033e1541f6a81972e7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_tags" DROP CONSTRAINT "FK_70515bc464901781ac60b82a1ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_26dedda08faccdb95aff99e112e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_1ae6688b1bd90fffe857f4cb707"`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_block_tags" DROP CONSTRAINT "FK_8704e0fe5627b9514b24d898f7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_block_tags" DROP CONSTRAINT "FK_8eee5fc7e05f49c69e84f4cd384"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issued_access_tokens" DROP CONSTRAINT "FK_20f8dee70027015cf098a9cbf93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issued_access_tokens" DROP CONSTRAINT "FK_d9204aec1e09d08d06011993cd4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_refresh_tokens" DROP CONSTRAINT "FK_20955b8ef7f0e27ee2198a80015"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" DROP CONSTRAINT "FK_0bf6704cedff2e876c78f692398"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" DROP CONSTRAINT "FK_a16cb7e1605a1d6347ba1f40ad3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" DROP CONSTRAINT "FK_e059c1afc29350cf077fec4c41b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "authorization_journeys" DROP CONSTRAINT "FK_52f76ac34609751f50ec32e01b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "connection_authorization_flows" DROP CONSTRAINT "FK_9733b428ec183d2f631fe084a19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "connection_authorization_flows" DROP CONSTRAINT "FK_0202c0a6cdc97d768d2f30bd98e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_task_executions" DROP CONSTRAINT "FK_76b62d7c79a8d94670416e9f431"`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_task_executions" DROP CONSTRAINT "FK_ff4cf561fb305efc1fe12c52d7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_execution_history" DROP CONSTRAINT "FK_7142473429261e167efdb3cc233"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_execution_history" DROP CONSTRAINT "FK_984e814ae64967b7b44c489f31a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_execution_queue" DROP CONSTRAINT "FK_e6293cc4ad257649be5e6f58598"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" DROP CONSTRAINT "FK_696fd2a86092b418b8d9f4b98a1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" DROP CONSTRAINT "FK_76579c6cb0dd9963517972ff181"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_providers" DROP CONSTRAINT "FK_ce21fdd216a3dc4449048d98701"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_30fa6513ff893536087fece24e4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag_usage" DROP CONSTRAINT "FK_fc603902944def35770f762c0e8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "secrets" DROP CONSTRAINT "FK_b90f89051d9de67b62a3c412e04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_tasks" DROP CONSTRAINT "FK_e0ed072463cead4e3c32ee96a70"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_blueprints" DROP CONSTRAINT "FK_04d8ca9e76a6128b419f3e4ead4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_blueprints" DROP CONSTRAINT "FK_7c590d2fc49e749264538ceb4bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" DROP CONSTRAINT "FK_108b53483c683c9984d2a2c50e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" DROP CONSTRAINT "FK_f93fd3ebb839bcfec39507a7a08"`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads" DROP CONSTRAINT "FK_88952da3cfbf9e9618e7bb36555"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_messages" DROP CONSTRAINT "FK_50433df7361de1e6aaa5ce135f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_messages" DROP CONSTRAINT "FK_c6bc073e77f201aa2fdbaa1688e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_a3e0f9b54499d948c2d62c8ef03"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_733d1181d78ed254ea08e8683c4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_blocks" DROP CONSTRAINT "FK_938da9a0857d1b418dcc33e7326"`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_blocks" DROP CONSTRAINT "FK_b34d08eeab998b83e5ca84d7b7b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_blocks" DROP CONSTRAINT "FK_1700363b5a5db27b0f2ea2cc39d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_input_requests" DROP CONSTRAINT "FK_99c0a77a070c5ff4eb339107d00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_input_requests" DROP CONSTRAINT "FK_12bbab9cd739978a4ac7a318b5b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_input_requests" DROP CONSTRAINT "FK_de2e79dbc1588bfc1e6416329f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "artefacts" DROP CONSTRAINT "FK_7841ac39f494f914d5200cb94be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_18c2493067c11f44efb35ca0e03"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_bbfbee2b1b4f9f1f7de4c02654c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP CONSTRAINT "FK_2c4c2595e6f8699f2b26b5e7589"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_permissions" DROP CONSTRAINT "FK_f1eb1e26820d24a12c626b81e91"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_permissions" DROP CONSTRAINT "FK_c9e747b35e1b9f6a9ac109685ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_scopes" DROP CONSTRAINT "FK_68cecda9c8d84c8c61f229a4be2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_permission_scopes" DROP CONSTRAINT "FK_71546cc2626cf18017c63ff518f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_tool_permission_scopes" DROP CONSTRAINT "FK_fea954ca4ca5815942a26c5ad53"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_scope_mappings" DROP CONSTRAINT "FK_c376dcb7f9a05b39c08d63622bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_scope_mappings" DROP CONSTRAINT "FK_2b56cc692e2f3b451195876c4e9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_connections" DROP CONSTRAINT "FK_ec0a65330c7c528d7ee7cd09b4a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_0c17e643b069470055be07d69ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workers" DROP CONSTRAINT "FK_504178c0ec7be818c522c0f01af"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d7aba355071665af6488f130a7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b2bd456852196e805b98e962bc"`,
    );
    await queryRunner.query(`DROP TABLE "task_blueprint_tags"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_88073a6748e95733b098e74996"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c0b642fb1e69a2d51ad4a42763"`,
    );
    await queryRunner.query(`DROP TABLE "thread_participants"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ee437d566a7d008da12d2424c6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3b7d48bd25da9d3618981fdc3a"`,
    );
    await queryRunner.query(`DROP TABLE "thread_tags"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7ee41ccd22caec2f434d2fa180"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0ac4c88dcd93e8152d743bcd8"`,
    );
    await queryRunner.query(`DROP TABLE "thread_context_blocks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_27940e313cd1b50301ca7b9927"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9dfa54dc69d0b1b215d36e4fcb"`,
    );
    await queryRunner.query(`DROP TABLE "thread_tasks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f883135d033e1541f6a81972e7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_70515bc464901781ac60b82a1e"`,
    );
    await queryRunner.query(`DROP TABLE "task_tags"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_26dedda08faccdb95aff99e112"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ae6688b1bd90fffe857f4cb70"`,
    );
    await queryRunner.query(`DROP TABLE "task_dependencies"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8704e0fe5627b9514b24d898f7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8eee5fc7e05f49c69e84f4cd38"`,
    );
    await queryRunner.query(`DROP TABLE "context_block_tags"`);
    await queryRunner.query(`DROP TABLE "jwks_keys"`);
    await queryRunner.query(`DROP TABLE "issued_access_tokens"`);
    await queryRunner.query(`DROP TABLE "mcp_refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "mcp_authorization_flows"`);
    await queryRunner.query(`DROP TABLE "authorization_journeys"`);
    await queryRunner.query(`DROP TABLE "connection_authorization_flows"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "active_task_executions"`);
    await queryRunner.query(`DROP TABLE "task_execution_history"`);
    await queryRunner.query(`DROP TABLE "task_execution_queue"`);
    await queryRunner.query(`DROP TABLE "execution_stats"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_agent_runs_task_execution_id"`,
    );
    await queryRunner.query(`DROP TABLE "agent_runs"`);
    await queryRunner.query(`DROP TABLE "chat_providers"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc603902944def35770f762c0e"`,
    );
    await queryRunner.query(`DROP TABLE "tag_usage"`);
    await queryRunner.query(`DROP TABLE "secrets"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_scheduled_tasks_enabled_next_run_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_scheduled_tasks_task_blueprint_id"`,
    );
    await queryRunner.query(`DROP TABLE "scheduled_tasks"`);
    await queryRunner.query(`DROP TABLE "task_blueprints"`);
    await queryRunner.query(`DROP TABLE "threads"`);
    await queryRunner.query(`DROP TABLE "thread_messages"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a9ba3074228102f4d699f5364f"`,
    );
    await queryRunner.query(`DROP TABLE "context_blocks"`);
    await queryRunner.query(`DROP TABLE "task_input_requests"`);
    await queryRunner.query(`DROP TABLE "artefacts"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP TABLE "actors"`);
    await queryRunner.query(`DROP TABLE "agents"`);
    await queryRunner.query(`DROP TABLE "agent_tool_permissions"`);
    await queryRunner.query(`DROP TABLE "mcp_servers"`);
    await queryRunner.query(`DROP TABLE "mcp_scopes"`);
    await queryRunner.query(`DROP TABLE "agent_tool_permission_scopes"`);
    await queryRunner.query(`DROP TABLE "mcp_scope_mappings"`);
    await queryRunner.query(`DROP TABLE "mcp_connections"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "workers"`);
    await queryRunner.query(`DROP TABLE "registered_clients"`);
  }
}
