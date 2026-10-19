import { INTERNAL_WORKER_AUTH_TARGET_ID } from 'src/auth/core/constants/internal-auth-target.constant';
import { SearchResultType } from '../enums';
import { SearchEntityType } from '../search.types';

/**
 * How each kind of item becomes a row of the search index.
 *
 * A projection is a SELECT over the source tables returning the index columns
 * for every live item. The indexer wraps it to insert what is missing, update
 * what changed and delete what is gone, either for everything (the sweep and
 * the first backfill) or for one result (right after a write).
 */
export type SearchProjection = {
  entityType: SearchEntityType;
  resultType: `${SearchResultType}`;
  /**
   * Must return: entity_id, result_id, title, search_title, body, keywords,
   * body_weight, meta, source_updated_at. `{{SCOPE}}` is replaced with an
   * extra condition, or with nothing.
   */
  select: string;
  /** Column expression holding the result id, used to narrow the select to one result. */
  resultIdExpression: string;
};


const TASK_TAGS = `(
  SELECT string_agg(g."name", ' ' ORDER BY g."name")
  FROM "task_tags" tt JOIN "tags" g ON g."id" = tt."tag_id"
  WHERE tt."task_id" = t."id" AND g."deleted_at" IS NULL
)`;

const BLOCK_TAGS = `(
  SELECT string_agg(g."name", ' ' ORDER BY g."name")
  FROM "context_block_tags" bt JOIN "tags" g ON g."id" = bt."tag_id"
  WHERE bt."block_id" = b."id" AND g."deleted_at" IS NULL
)`;

const THREAD_TAGS = `(
  SELECT string_agg(g."name", ' ' ORDER BY g."name")
  FROM "thread_tags" tt JOIN "tags" g ON g."id" = tt."tag_id"
  WHERE tt."thread_id" = t."id" AND g."deleted_at" IS NULL
)`;

export const SEARCH_PROJECTIONS: readonly SearchProjection[] = [
  {
    entityType: 'task',
    resultType: 'task',
    resultIdExpression: `t."id"`,
    select: `
      SELECT t."id" AS entity_id, t."id" AS result_id,
             t."name"::text AS title, t."name"::text AS search_title,
             coalesce(t."description", '') AS body,
             coalesce(${TASK_TAGS}, '') AS keywords,
             'B'::"char" AS body_weight,
             jsonb_build_object('status', t."status") AS meta,
             t."updated_at" AS source_updated_at
      FROM "tasks" t
      WHERE t."deleted_at" IS NULL {{SCOPE}}`,
  },
  {
    // A comment is found on its own text but opens its task. It is re-indexed
    // whenever the task changes, because it carries the task's name and status.
    entityType: 'comment',
    resultType: 'task',
    resultIdExpression: `t."id"`,
    select: `
      SELECT c."id" AS entity_id, t."id" AS result_id,
             t."name"::text AS title, '' AS search_title,
             c."content" AS body,
             '' AS keywords,
             'C'::"char" AS body_weight,
             jsonb_build_object('status', t."status", 'author', a."display_name") AS meta,
             greatest(c."updated_at", t."updated_at") AS source_updated_at
      FROM "comments" c
      JOIN "tasks" t ON t."id" = c."task_id"
      LEFT JOIN "actors" a ON a."id" = c."commenter_actor_id"
      WHERE c."deleted_at" IS NULL AND t."deleted_at" IS NULL {{SCOPE}}`,
  },
  {
    entityType: 'context_block',
    resultType: 'context_block',
    resultIdExpression: `b."id"`,
    select: `
      SELECT b."id" AS entity_id, b."id" AS result_id,
             b."title" AS title, b."title" AS search_title,
             coalesce(b."content", '') AS body,
             coalesce(${BLOCK_TAGS}, '') AS keywords,
             'B'::"char" AS body_weight,
             '{}'::jsonb AS meta,
             b."updated_at" AS source_updated_at
      FROM "context_blocks" b
      -- A thread's state memory is indexed as the thread, below. Deleting a thread
      -- deletes its state block too, so it stops being searchable altogether.
      WHERE b."deleted_at" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "threads" t WHERE t."state_context_block_id" = b."id") {{SCOPE}}`,
  },
  {
    // A thread is found through its title and its state memory, the generated
    // block that holds its goal and progress, and opens the thread itself.
    entityType: 'thread',
    resultType: 'thread',
    resultIdExpression: `t."id"`,
    select: `
      SELECT t."id" AS entity_id, t."id" AS result_id,
             t."title" AS title, t."title" AS search_title,
             coalesce(b."content", '') AS body,
             coalesce(${THREAD_TAGS}, '') AS keywords,
             'B'::"char" AS body_weight,
             '{}'::jsonb AS meta,
             greatest(t."updated_at", b."updated_at") AS source_updated_at
      FROM "threads" t
      JOIN "context_blocks" b ON b."id" = t."state_context_block_id" AND b."deleted_at" IS NULL
      WHERE TRUE {{SCOPE}}`,
  },
  {
    entityType: 'tool',
    resultType: 'tool',
    resultIdExpression: `s."id"`,
    select: `
      SELECT s."id" AS entity_id, s."id" AS result_id,
             s."name"::text AS title, s."name"::text AS search_title,
             coalesce(s."description", '') AS body,
             s."providedId"::text AS keywords,
             'B'::"char" AS body_weight,
             '{}'::jsonb AS meta,
             s."updatedAt" AS source_updated_at
      FROM "mcp_servers" s
      -- The worker's own registry entry exists for authorization only.
      WHERE s."deletedAt" IS NULL AND s."providedId" <> '${INTERNAL_WORKER_AUTH_TARGET_ID}' {{SCOPE}}`,
  },
  {
    entityType: 'agent',
    resultType: 'agent',
    resultIdExpression: `g."id"`,
    select: `
      SELECT g."id" AS entity_id, g."id" AS result_id,
             a."display_name" AS title, a."display_name" AS search_title,
             concat_ws(E'\\n\\n', nullif(g."description", ''), nullif(a."introduction", '')) AS body,
             a."slug" AS keywords,
             'B'::"char" AS body_weight,
             jsonb_build_object('slug', a."slug") AS meta,
             greatest(g."updated_at", a."updated_at") AS source_updated_at
      FROM "agents" g
      JOIN "actors" a ON a."id" = g."actor_id"
      WHERE g."deleted_at" IS NULL AND a."deleted_at" IS NULL {{SCOPE}}`,
  },
  {
    entityType: 'project',
    resultType: 'project',
    resultIdExpression: `p."id"`,
    select: `
      SELECT p."id" AS entity_id, p."id" AS result_id,
             p."slug" AS title, p."slug" AS search_title,
             coalesce(p."description", '') AS body,
             coalesce(p."repoUrl", '') AS keywords,
             'B'::"char" AS body_weight,
             '{}'::jsonb AS meta,
             p."updated_at" AS source_updated_at
      FROM "projects" p
      WHERE p."deleted_at" IS NULL {{SCOPE}}`,
  },
];

export function projectionSelect(projection: SearchProjection, scoped: boolean): string {
  return projection.select.replace(
    '{{SCOPE}}',
    scoped ? `AND ${projection.resultIdExpression} = $1` : '',
  );
}
