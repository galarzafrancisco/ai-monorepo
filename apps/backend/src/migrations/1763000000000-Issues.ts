import { MigrationInterface, QueryRunner } from 'typeorm';

const ISSUE_URL = String.raw`https?://(?:www\.)?([A-Za-z0-9.-]+(?::[0-9]{1,5})?)/([A-Za-z0-9-]+)/([A-Za-z0-9._-]+)/issues/([0-9]{1,9})(?![0-9])`;

/**
 * Taico's copy of linked GitHub issues, and where they are linked from.
 *
 * Links already written in tasks, comments and threads, on github.com or on
 * a GitHub Enterprise Taico has a connection to, are recorded as references.
 * Their issues are not read from GitHub until someone looks at them, so
 * upgrading does not fire a burst of requests.
 */
export class Issues1763000000000 implements MigrationInterface {
  name = 'Issues1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "issues" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" text NOT NULL,
        "host" text NOT NULL DEFAULT 'github.com',
        "owner" text NOT NULL,
        "repo" text NOT NULL,
        "number" integer NOT NULL,
        "title" text NULL,
        "state" text NULL,
        "state_reason" text NULL,
        "is_pull_request" boolean NOT NULL DEFAULT false,
        "author_login" text NULL,
        "labels" jsonb NOT NULL DEFAULT '[]',
        "assignees" jsonb NOT NULL DEFAULT '[]',
        "milestone" text NULL,
        "comment_count" integer NULL,
        "closed_at" timestamptz NULL,
        "github_updated_at" timestamptz NULL,
        "etags" jsonb NOT NULL DEFAULT '{}',
        "last_fetched_at" timestamptz NULL,
        "next_fetch_at" timestamptz NULL,
        "last_error" text NULL,
        "failed_fetches" integer NOT NULL DEFAULT 0,
        "last_viewed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issues_id" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_issues_key" ON "issues" ("key")`);
    await queryRunner.query(`CREATE INDEX "IDX_issues_next_fetch_at" ON "issues" ("next_fetch_at")`);

    await queryRunner.query(`
      CREATE TABLE "issue_references" (
        "issue_id" uuid NOT NULL,
        "source_type" text NOT NULL,
        "source_id" uuid NOT NULL,
        "task_id" uuid NULL,
        "thread_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_references" PRIMARY KEY ("issue_id", "source_type", "source_id"),
        CONSTRAINT "FK_issue_references_issue" FOREIGN KEY ("issue_id")
          REFERENCES "issues"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_issue_references_task" ON "issue_references" ("task_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_issue_references_thread" ON "issue_references" ("thread_id")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_issue_references_source" ON "issue_references" ("source_type", "source_id")`,
    );

    await this.backfillReferences(queryRunner);
  }

  private async backfillReferences(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TEMP TABLE "issue_link_backfill" ON COMMIT DROP AS
       SELECT DISTINCT source_type, source_id, task_id, thread_id, created_at,
              host, owner, repo, number,
              lower(CASE WHEN host = 'github.com' THEN '' ELSE host || '/' END || owner || '/' || repo || '#' || number) AS key
         FROM (
           SELECT source_type, source_id, task_id, thread_id, created_at,
                  lower(m[1]) AS host, m[2] AS owner, m[3] AS repo, m[4]::integer AS number
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
             ) matched
         ) found
        WHERE number > 0
          AND (host = 'github.com'
               OR host IN (SELECT lower(substring(base_url FROM '^https?://([^/]+)')) FROM github_connections))`,
      [ISSUE_URL],
    );
    await queryRunner.query(`
      INSERT INTO issues (key, host, owner, repo, number)
      SELECT DISTINCT ON (key) key, host, owner, repo, number FROM issue_link_backfill ORDER BY key, created_at
      ON CONFLICT (key) DO NOTHING`);
    await queryRunner.query(`
      INSERT INTO issue_references (issue_id, source_type, source_id, task_id, thread_id, created_at)
      SELECT i.id, b.source_type, b.source_id, b.task_id, b.thread_id, b.created_at
        FROM issue_link_backfill b JOIN issues i ON i.key = b.key
      ON CONFLICT DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "issue_references"`);
    await queryRunner.query(`DROP TABLE "issues"`);
  }
}
