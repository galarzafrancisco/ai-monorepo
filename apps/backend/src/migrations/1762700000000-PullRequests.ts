import { MigrationInterface, QueryRunner } from 'typeorm';

const PULL_REQUEST_URL = String.raw`https?://(?:www\.)?github\.com/([A-Za-z0-9-]+)/([A-Za-z0-9._-]+)/pull/([0-9]{1,9})`;

/**
 * Taico's copy of linked GitHub pull requests, where they are linked from, and
 * webhook settings for GitHub connections.
 *
 * Links already written in tasks, comments and threads are recorded as
 * references. Their pull requests are not read from GitHub until someone looks
 * at them, so upgrading does not fire a burst of requests.
 */
export class PullRequests1762700000000 implements MigrationInterface {
  name = 'PullRequests1762700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "github_connections" ADD "webhook_secret_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "github_connections" ADD "last_webhook_at" timestamptz NULL`);
    await queryRunner.query(`
      ALTER TABLE "github_connections" ADD CONSTRAINT "FK_github_connections_webhook_secret"
        FOREIGN KEY ("webhook_secret_id") REFERENCES "secrets"("id")`);

    await queryRunner.query(`
      CREATE TABLE "pull_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" text NOT NULL,
        "owner" text NOT NULL,
        "repo" text NOT NULL,
        "number" integer NOT NULL,
        "title" text NULL,
        "state" text NULL,
        "draft" boolean NOT NULL DEFAULT false,
        "author_login" text NULL,
        "head_sha" text NULL,
        "head_ref" text NULL,
        "base_ref" text NULL,
        "additions" integer NULL,
        "deletions" integer NULL,
        "changed_files" integer NULL,
        "comment_count" integer NULL,
        "checks_status" text NOT NULL DEFAULT 'none',
        "checks_total" integer NOT NULL DEFAULT 0,
        "checks_passed" integer NOT NULL DEFAULT 0,
        "checks_failed" integer NOT NULL DEFAULT 0,
        "checks_pending" integer NOT NULL DEFAULT 0,
        "failed_checks" jsonb NOT NULL DEFAULT '[]',
        "review_decision" text NOT NULL DEFAULT 'none',
        "approvals" integer NOT NULL DEFAULT 0,
        "merged_at" timestamptz NULL,
        "closed_at" timestamptz NULL,
        "github_updated_at" timestamptz NULL,
        "etags" jsonb NOT NULL DEFAULT '{}',
        "last_fetched_at" timestamptz NULL,
        "next_fetch_at" timestamptz NULL,
        "last_error" text NULL,
        "failed_fetches" integer NOT NULL DEFAULT 0,
        "last_viewed_at" timestamptz NULL,
        "watched_until" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pull_requests_id" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_pull_requests_key" ON "pull_requests" ("key")`);
    await queryRunner.query(`CREATE INDEX "IDX_pull_requests_next_fetch_at" ON "pull_requests" ("next_fetch_at")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_requests_head" ON "pull_requests" (lower("owner"), lower("repo"), "head_sha")`,
    );

    await queryRunner.query(`
      CREATE TABLE "pull_request_references" (
        "pull_request_id" uuid NOT NULL,
        "source_type" text NOT NULL,
        "source_id" uuid NOT NULL,
        "task_id" uuid NULL,
        "thread_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pull_request_references" PRIMARY KEY ("pull_request_id", "source_type", "source_id"),
        CONSTRAINT "FK_pull_request_references_pull_request" FOREIGN KEY ("pull_request_id")
          REFERENCES "pull_requests"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_pull_request_references_task" ON "pull_request_references" ("task_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_pull_request_references_thread" ON "pull_request_references" ("thread_id")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_request_references_source" ON "pull_request_references" ("source_type", "source_id")`,
    );

    await this.backfillReferences(queryRunner);
  }

  private async backfillReferences(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TEMP TABLE "pr_link_backfill" ON COMMIT DROP AS
       SELECT DISTINCT source_type, source_id, task_id, thread_id, created_at,
              m[1] AS owner, m[2] AS repo, m[3]::integer AS number,
              lower(m[1] || '/' || m[2] || '#' || m[3]::integer) AS key
         FROM (
           SELECT 'task_artefact' AS source_type, a.id AS source_id, a.task_id, NULL::uuid AS thread_id,
                  a.created_at, regexp_matches(a.link, $1, 'g') AS m
             FROM artefacts a WHERE a.deleted_at IS NULL
           UNION ALL
           SELECT 'task_description', t.id, t.id, NULL::uuid, t.created_at,
                  regexp_matches(coalesce(t.name, '') || ' ' || coalesce(t.description, ''), $1, 'g')
             FROM tasks t WHERE t.deleted_at IS NULL
           UNION ALL
           SELECT 'task_comment', c.id, c.task_id, NULL::uuid, c.created_at, regexp_matches(c.content, $1, 'g')
             FROM comments c WHERE c.deleted_at IS NULL
           UNION ALL
           SELECT 'thread_message', tm.id, NULL::uuid, tm.thread_id, tm.created_at, regexp_matches(tm.content, $1, 'g')
             FROM thread_messages tm
         ) found
        WHERE m[3]::integer > 0`,
      [PULL_REQUEST_URL],
    );
    await queryRunner.query(`
      INSERT INTO pull_requests (key, owner, repo, number)
      SELECT DISTINCT ON (key) key, owner, repo, number FROM pr_link_backfill ORDER BY key, created_at
      ON CONFLICT (key) DO NOTHING`);
    await queryRunner.query(`
      INSERT INTO pull_request_references (pull_request_id, source_type, source_id, task_id, thread_id, created_at)
      SELECT p.id, b.source_type, b.source_id, b.task_id, b.thread_id, b.created_at
        FROM pr_link_backfill b JOIN pull_requests p ON p.key = b.key
      ON CONFLICT DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pull_request_references"`);
    await queryRunner.query(`DROP TABLE "pull_requests"`);
    await queryRunner.query(`ALTER TABLE "github_connections" DROP CONSTRAINT "FK_github_connections_webhook_secret"`);
    await queryRunner.query(`ALTER TABLE "github_connections" DROP COLUMN "last_webhook_at"`);
    await queryRunner.query(`ALTER TABLE "github_connections" DROP COLUMN "webhook_secret_id"`);
  }
}
