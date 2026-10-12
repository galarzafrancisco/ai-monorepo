/**
 * The search index's own tables. They are derived data: everything in them
 * can be rebuilt from the tasks, comments, context blocks, tools, agents and
 * projects they describe.
 *
 * Every statement is idempotent. The lexical part is applied by a migration;
 * the vector part is applied at runtime because it needs the pgvector
 * extension, which a database may not have yet (see SearchVectorStoreService).
 */

/** Longest text handed to to_tsvector; a tsvector cannot exceed 1 MB. */
const TSVECTOR_INPUT_CHARS = 400_000;

export const SEARCH_TEXT_CONFIG = 'english';

export const LEXICAL_SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE EXTENSION IF NOT EXISTS "pg_trgm"`,
  `CREATE TABLE IF NOT EXISTS "search_documents" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" text NOT NULL,
    "entity_id" uuid NOT NULL,
    "result_type" text NOT NULL,
    "result_id" uuid NOT NULL,
    "title" text NOT NULL,
    "search_title" text NOT NULL DEFAULT '',
    "body" text NOT NULL DEFAULT '',
    "keywords" text NOT NULL DEFAULT '',
    "body_weight" "char" NOT NULL DEFAULT 'B',
    "meta" jsonb NOT NULL DEFAULT '{}',
    "source_updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "content_hash" text NOT NULL,
    "tsv" tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('${SEARCH_TEXT_CONFIG}', left("search_title", ${TSVECTOR_INPUT_CHARS})), 'A') ||
      setweight(to_tsvector('${SEARCH_TEXT_CONFIG}', left("keywords", ${TSVECTOR_INPUT_CHARS})), 'B') ||
      setweight(to_tsvector('${SEARCH_TEXT_CONFIG}', left("body", ${TSVECTOR_INPUT_CHARS})), "body_weight")
    ) STORED,
    "embedded_fingerprint" text,
    "embed_attempts" integer NOT NULL DEFAULT 0,
    "embed_error" text,
    "embed_retry_at" TIMESTAMP WITH TIME ZONE,
    "embed_claimed_until" TIMESTAMP WITH TIME ZONE,
    "indexed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_search_documents" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_search_documents_entity" UNIQUE ("entity_type", "entity_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_search_documents_result" ON "search_documents" ("result_type", "result_id")`,
  `CREATE INDEX IF NOT EXISTS "IDX_search_documents_tsv" ON "search_documents" USING gin ("tsv")`,
  `CREATE INDEX IF NOT EXISTS "IDX_search_documents_title_trgm" ON "search_documents" USING gin ("search_title" gin_trgm_ops)`,
  `CREATE TABLE IF NOT EXISTS "search_settings" (
    "id" smallint NOT NULL DEFAULT 1,
    "settings" jsonb NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_search_settings" PRIMARY KEY ("id"),
    CONSTRAINT "CHK_search_settings_single_row" CHECK ("id" = 1)
  )`,
];

/**
 * The embedding column has no fixed dimension, so changing the embedding
 * model never needs a schema change. Each row records its own model and
 * dimension, and nearest-neighbour indexes are created per dimension.
 */
export const VECTOR_SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "search_chunks" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "document_id" uuid NOT NULL,
    "kind" text NOT NULL,
    "ordinal" integer NOT NULL,
    "text" text NOT NULL,
    "text_hash" text NOT NULL,
    "model" text NOT NULL,
    "dimensions" integer NOT NULL,
    "embedding" vector NOT NULL,
    CONSTRAINT "PK_search_chunks" PRIMARY KEY ("id"),
    CONSTRAINT "FK_search_chunks_document" FOREIGN KEY ("document_id") REFERENCES "search_documents"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_search_chunks_document" ON "search_chunks" ("document_id")`,
];

/** pgvector cannot build an HNSW index on a vector with more dimensions than this. */
export const MAX_ANN_INDEX_DIMENSIONS = 2000;

/**
 * Approximate nearest-neighbour index for one embedding dimension. Queries
 * must use the same `embedding::vector(n)` expression and `dimensions = n`
 * filter for the planner to pick it.
 */
export function annIndexStatement(dimensions: number): string {
  const n = Math.trunc(dimensions);
  return `CREATE INDEX IF NOT EXISTS "IDX_search_chunks_hnsw_${n}" ON "search_chunks" USING hnsw (("embedding"::vector(${n})) vector_cosine_ops) WHERE "dimensions" = ${n}`;
}

export const DROP_SEARCH_SCHEMA_STATEMENTS: readonly string[] = [
  `DROP TABLE IF EXISTS "search_chunks"`,
  `DROP TABLE IF EXISTS "search_documents"`,
  `DROP TABLE IF EXISTS "search_settings"`,
];
