import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SearchMatchField, SearchResultType, SearchStrategy } from '../enums';
import { IndexSearchInput, IndexSearchResult, SearchEntityType } from '../search.types';
import { SearchEmbeddingsService } from './search-embeddings.service';
import { ExcerptSource, pickExcerpt } from './search-excerpt';
import { SEARCH_TEXT_CONFIG } from './search-schema';
import { SearchSettings } from './search-settings';
import { SearchSettingsService } from './search-settings.service';
import { SearchVectorStoreService } from './search-vector-store.service';

const MAX_QUERY_CHARS = 1000;
const MAX_LIMIT = 100;
/** Passages fetched per wanted item, since several passages of one item can be among the nearest. */
const PASSAGES_PER_CANDIDATE = 3;
/** With more plain terms than this, a keyword query that matches nothing is not retried with a term left out. */
const MAX_LOOSE_TERMS = 6;
/** ts_headline reads the text again, so it is given a bounded prefix. */
const HEADLINE_INPUT_CHARS = 100_000;

type QueryVector = { literal: string; dimensions: number; modelKey: string };

type ResultRow = ExcerptSource & {
  result_type: SearchResultType;
  result_id: string;
  title: string;
  meta: Record<string, unknown> | null;
  score: number;
  matched_by: SearchStrategy[];
  ranks: Partial<Record<SearchStrategy, number>>;
};

/**
 * Search over the index. Three strategies each produce a ranked list of
 * candidates:
 *
 * - keyword: full-text match on title, tags and text (stemmed, title weighted highest)
 * - fuzzy_title: trigram similarity to the title, which forgives typos and partial words
 * - semantic: nearest passages to the query's embedding
 *
 * The lists are merged with reciprocal rank fusion, which uses only each
 * candidate's position in each list. That is what lets a task, a context
 * block and a tool share one ranking: their raw scores are never compared.
 */
@Injectable()
export class IndexSearchService {
  private readonly logger = new Logger(IndexSearchService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settingsService: SearchSettingsService,
    private readonly vectorStore: SearchVectorStoreService,
    private readonly embeddings: SearchEmbeddingsService,
  ) {}

  async search(input: IndexSearchInput): Promise<IndexSearchResult[]> {
    const query = input.query.trim().slice(0, MAX_QUERY_CHARS);
    if (!query) {
      return [];
    }
    const settings = await this.settingsService.get();
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? settings.defaultLimit), 1), MAX_LIMIT);
    const types = input.types?.length ? [...input.types] : Object.values(SearchResultType);

    const startedAt = Date.now();
    const vector = await this.embedQuery(query, settings);
    const embeddedAt = Date.now();

    const strategies: SearchStrategy[] = [];
    if (settings.keywordWeight > 0) strategies.push(SearchStrategy.KEYWORD);
    if (settings.fuzzyTitleWeight > 0) strategies.push(SearchStrategy.FUZZY_TITLE);
    if (vector && settings.semanticWeight > 0) strategies.push(SearchStrategy.SEMANTIC);
    if (strategies.length === 0) {
      return [];
    }

    const rows = await this.runQuery({ query, types, limit, settings, strategies, vector });
    const results = rows.map((row) => toResult(row, settings, strategies));

    this.logger.log({
      message: 'Search completed',
      query,
      types: input.types ?? 'all',
      strategies,
      resultCount: results.length,
      embedMs: embeddedAt - startedAt,
      queryMs: Date.now() - embeddedAt,
    });
    return results;
  }

  /** The query's embedding, or null when semantic search cannot contribute to this request. */
  private async embedQuery(query: string, settings: SearchSettings): Promise<QueryVector | null> {
    if (!settings.semanticEnabled || settings.semanticWeight <= 0) {
      return null;
    }
    try {
      if (!(await this.vectorStore.isAvailable())) {
        return null;
      }
      const model = await this.embeddings.resolveModel();
      if (!model) {
        return null;
      }
      const embedding = await this.embeddings.embedQuery(model, query, {
        instruction: settings.queryInstruction,
        timeoutMs: settings.queryEmbeddingTimeoutMs,
      });
      return {
        literal: `[${embedding.join(',')}]`,
        dimensions: embedding.length,
        modelKey: model.key,
      };
    } catch (error) {
      // A slow or failing embedding model degrades the search; it does not fail it.
      this.logger.warn({
        message: 'Query embedding failed; searching without semantic matches',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async runQuery(input: {
    query: string;
    types: SearchResultType[];
    limit: number;
    settings: SearchSettings;
    strategies: SearchStrategy[];
    vector: QueryVector | null;
  }): Promise<ResultRow[]> {
    const { query, types, limit, settings, strategies, vector } = input;
    const parameters: unknown[] = [];
    const bind = (value: unknown): string => {
      parameters.push(value);
      return `$${parameters.length}`;
    };

    const q = bind(query);
    const typeList = `${bind(types)}::text[]`;
    const candidates = `${bind(settings.candidatesPerStrategy)}::int`;
    const rrfK = `${bind(settings.rrfK)}::float8`;
    const weight = (strategy: SearchStrategy): string =>
      `${bind(strategyWeights(settings)[strategy])}::float8`;

    const lists: string[] = [];
    const hits: string[] = [];

    if (strategies.includes(SearchStrategy.KEYWORD)) {
      // All terms must match. When nothing matches all of them, one term may be missing.
      // A match whose terms are scattered across a long text is dropped: its cover density
      // (how close together the terms occur) is far below that of a real match.
      const minDensity = `${bind(settings.keywordMinDensity)}::float4`;
      const keywordList = (name: string, tsquery: string, condition: string) => `
        ${name} AS (
          SELECT d."id" AS doc_id,
                 row_number() OVER (ORDER BY ts_rank_cd(d."tsv", ${tsquery}, 1) DESC, d."id") AS rank
          FROM "search_documents" d, tsq
          WHERE ${condition}
            AND d."tsv" @@ ${tsquery} AND d."result_type" = ANY(${typeList})
            AND ts_rank_cd(d."tsv", ${tsquery}) >= ${minDensity}
          ORDER BY rank LIMIT ${candidates}
        )`;
      lists.push(
        keywordList('strict_keyword', 'tsq.strict_q', 'TRUE'),
        keywordList('loose_keyword', 'tsq.loose_q', 'NOT EXISTS (SELECT 1 FROM strict_keyword)'),
      );
      hits.push(
        `SELECT doc_id, 'keyword' AS strategy, rank, NULL::uuid AS chunk_id, ${weight(SearchStrategy.KEYWORD)} AS weight FROM strict_keyword`,
        `SELECT doc_id, 'keyword', rank, NULL::uuid, ${weight(SearchStrategy.KEYWORD)} FROM loose_keyword`,
      );
    }

    if (strategies.includes(SearchStrategy.FUZZY_TITLE)) {
      lists.push(`
        fuzzy_title AS (
          SELECT d."id" AS doc_id,
                 row_number() OVER (ORDER BY word_similarity(${q}, d."search_title") DESC, d."id") AS rank
          FROM "search_documents" d
          WHERE ${q} <% d."search_title" AND d."result_type" = ANY(${typeList})
          ORDER BY rank LIMIT ${candidates}
        )`);
      hits.push(
        `SELECT doc_id, 'fuzzy_title', rank, NULL::uuid, ${weight(SearchStrategy.FUZZY_TITLE)} FROM fuzzy_title`,
      );
    }

    const semantic = strategies.includes(SearchStrategy.SEMANTIC) && vector !== null;
    if (semantic) {
      const dimensions = Math.trunc(vector.dimensions);
      const embedding = `${bind(vector.literal)}::vector(${dimensions})`;
      lists.push(`
        nearest AS (
          SELECT c."id" AS chunk_id, c."document_id" AS doc_id,
                 c."embedding"::vector(${dimensions}) <=> ${embedding} AS distance
          FROM "search_chunks" c
          JOIN "search_documents" d ON d."id" = c."document_id"
          WHERE c."dimensions" = ${dimensions} AND c."model" = ${bind(vector.modelKey)}
            AND d."result_type" = ANY(${typeList})
          ORDER BY distance
          LIMIT ${candidates} * ${PASSAGES_PER_CANDIDATE}
        ),
        best_passage AS (
          SELECT DISTINCT ON (doc_id) doc_id, chunk_id, distance
          FROM nearest
          WHERE distance <= ${bind(1 - settings.semanticMinSimilarity)}::float8
            -- With a strong match at the top, passages far behind it are noise.
            AND distance <= (SELECT min(distance) FROM nearest) + ${bind(settings.semanticMaxGap)}::float8
          ORDER BY doc_id, distance
        ),
        semantic AS (
          SELECT doc_id, chunk_id, row_number() OVER (ORDER BY distance, doc_id) AS rank
          FROM best_passage
          ORDER BY rank LIMIT ${candidates}
        )`);
      hits.push(`SELECT doc_id, 'semantic', rank, chunk_id, ${weight(SearchStrategy.SEMANTIC)} FROM semantic`);
    }

    const boost = `${bind(settings.exactTitleBoost)}::float8`;
    const excerptChars = `${bind(settings.excerptMaxChars)}::int`;
    // Equal scores are common (first in one list each). The closest in meaning goes first.
    const tieBreak = (alias: string) => `(${alias}.ranks->>'semantic')::int ASC NULLS LAST`;
    // Whichever form of the query matched: the strict one, or the one with a term left out.
    const anyQuery = `CASE WHEN tsq.loose_q IS NULL THEN tsq.strict_q ELSE tsq.strict_q || tsq.loose_q END`;
    const headlineOptions = `'MaxFragments=3, MinWords=15, MaxWords=60, FragmentDelimiter=" … ", StartSel="", StopSel=""'`;

    const sql = `
      WITH terms AS (
        -- One query per word, so a word can be left out. The text form of a tsquery is already quoted.
        SELECT DISTINCT plainto_tsquery('${SEARCH_TEXT_CONFIG}', w)::text AS term
        FROM regexp_split_to_table(${q}, '\\s+') AS w
        WHERE numnode(plainto_tsquery('${SEARCH_TEXT_CONFIG}', w)) > 0
      ),
      tsq AS (
        SELECT s.strict_q,
               -- "All but one term". Only for a handful of plain terms: with one term there is
               -- nothing to drop, a long sentence is a question for semantic search, and a
               -- negated term (-word) only makes sense when every term must hold.
               CASE WHEN (SELECT count(*) FROM terms) BETWEEN 2 AND ${MAX_LOOSE_TERMS}
                         AND s.strict_q::text NOT LIKE '%!%'
                    THEN (
                      SELECT string_agg(
                        '(' || (SELECT string_agg('(' || kept.term || ')', ' & ')
                                FROM terms kept WHERE kept.term <> dropped.term) || ')',
                        ' | ')
                      FROM terms dropped
                    )::tsquery
               END AS loose_q
        FROM (SELECT websearch_to_tsquery('${SEARCH_TEXT_CONFIG}', ${q}) AS strict_q) s
      ),
      ${lists.join(',')},
      hits AS (
        ${hits.join('\n        UNION ALL\n        ')}
      ),
      -- A task found through three comments is one result, placed by its best hit in each list.
      result_hits AS (
        SELECT d."result_type", d."result_id", h.strategy, h.weight, min(h.rank) AS rank
        FROM hits h JOIN "search_documents" d ON d."id" = h.doc_id
        GROUP BY d."result_type", d."result_id", h.strategy, h.weight
      ),
      fused AS (
        SELECT "result_type", "result_id",
               sum(weight / (${rrfK} + rank)) AS fused,
               array_agg(strategy ORDER BY strategy) AS matched_by,
               jsonb_object_agg(strategy, rank) AS ranks
        FROM result_hits
        GROUP BY "result_type", "result_id"
      ),
      ranked AS (
        SELECT f."result_type", f."result_id", f.matched_by, f.ranks, p."id" AS primary_doc_id,
               p."title", p."meta",
               (f.fused + CASE
                  WHEN lower(p."search_title") = lower(${q}) THEN ${boost}
                  WHEN starts_with(lower(p."search_title"), lower(${q})) THEN ${boost} / 2
                  ELSE 0 END)
               * CASE WHEN f."result_type" = 'task' AND p."meta"->>'status' = 'DONE'
                      THEN ${bind(settings.doneTaskMultiplier)}::float8 ELSE 1 END AS score
        FROM fused f
        -- The result's own row: a comment's row has a different entity type.
        JOIN "search_documents" p
          ON p."entity_type" = f."result_type" AND p."entity_id" = f."result_id"
        ORDER BY score DESC, ${tieBreak('f')}, p."title", f."result_id"
        LIMIT ${bind(limit)}::int
      ),
      -- The single hit that did most to place the result decides what the excerpt shows.
      best_hit AS (
        SELECT DISTINCT ON (d."result_type", d."result_id")
               d."result_type", d."result_id", h.strategy, h.doc_id, h.chunk_id
        FROM hits h JOIN "search_documents" d ON d."id" = h.doc_id
        ORDER BY d."result_type", d."result_id",
                 h.weight / (${rrfK} + h.rank) DESC, (h.strategy = 'semantic') DESC
      )
      SELECT r."result_type", r."result_id", r."title", r."meta", r.score, r.matched_by, r.ranks,
             b.strategy AS hit_strategy,
             hd."entity_type" AS hit_entity_type, hd."entity_id" AS hit_entity_id,
             hd."meta"->>'author' AS hit_author,
             char_length(hd."body") AS hit_body_length,
             left(hd."body", ${excerptChars}) AS hit_body_start,
             CASE WHEN b.strategy = 'keyword'
                  THEN to_tsvector('${SEARCH_TEXT_CONFIG}', left(hd."body", ${HEADLINE_INPUT_CHARS})) @@ ${anyQuery}
             END AS hit_body_matches,
             CASE WHEN b.strategy = 'keyword' AND char_length(hd."body") > ${excerptChars}
                  THEN ts_headline('${SEARCH_TEXT_CONFIG}', left(hd."body", ${HEADLINE_INPUT_CHARS}), ${anyQuery}, ${headlineOptions})
             END AS headline,
             ${semantic ? `c."kind"` : 'NULL'} AS chunk_kind,
             ${semantic ? `c."text"` : 'NULL'} AS chunk_text,
             char_length(p."body") AS primary_body_length,
             left(p."body", ${excerptChars}) AS primary_body_start
      FROM ranked r
      JOIN best_hit b ON b."result_type" = r."result_type" AND b."result_id" = r."result_id"
      JOIN "search_documents" hd ON hd."id" = b.doc_id
      JOIN "search_documents" p ON p."id" = r.primary_doc_id
      ${semantic ? `LEFT JOIN "search_chunks" c ON c."id" = b.chunk_id` : ''}
      CROSS JOIN tsq
      ORDER BY r.score DESC, ${tieBreak('r')}, r."title", r."result_id"`;

    return this.dataSource.transaction(async (manager) => {
      // Session settings that apply to this transaction only.
      await manager.query(`SELECT set_config('pg_trgm.word_similarity_threshold', $1, true)`, [
        String(settings.fuzzyMinSimilarity),
      ]);
      if (semantic) {
        const passages = settings.candidatesPerStrategy * PASSAGES_PER_CANDIDATE;
        await manager.query(`SELECT set_config('hnsw.ef_search', $1, true)`, [
          String(Math.min(Math.max(passages, 40), 1000)),
        ]);
        if (this.vectorStore.supportsIterativeScan()) {
          // Keep scanning the index until enough passages pass the type and model filters.
          await manager.query(`SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true)`);
        }
      }
      return manager.query(sql, parameters);
    });
  }
}

function strategyWeights(settings: SearchSettings): Record<SearchStrategy, number> {
  return {
    [SearchStrategy.KEYWORD]: settings.keywordWeight,
    [SearchStrategy.FUZZY_TITLE]: settings.fuzzyTitleWeight,
    [SearchStrategy.SEMANTIC]: settings.semanticWeight,
  };
}

/** Highest fused score a result can reach with these strategies; scores are reported relative to it. */
function maxScore(settings: SearchSettings, strategies: SearchStrategy[]): number {
  const weights = strategyWeights(settings);
  const fused = strategies.reduce(
    (total, strategy) => total + weights[strategy] / (settings.rrfK + 1),
    0,
  );
  return fused + settings.exactTitleBoost;
}

function toResult(
  row: ResultRow,
  settings: SearchSettings,
  strategies: SearchStrategy[],
): IndexSearchResult {
  const excerpt = pickExcerpt(row, settings.excerptMaxChars);
  const isComment = excerpt.matchedOn === SearchMatchField.COMMENT;
  return {
    type: row.result_type,
    id: row.result_id,
    title: row.title,
    score: Math.min(1, Math.max(0, Number(row.score) / maxScore(settings, strategies))),
    matchedBy: [...new Set(row.matched_by)],
    ranks: row.ranks,
    matchedOn: excerpt.matchedOn,
    excerpt: excerpt.text,
    excerptIsComplete: excerpt.isComplete,
    commentId: isComment ? row.hit_entity_id : null,
    commentAuthor: isComment ? row.hit_author : null,
    meta: row.meta ?? {},
  };
}
