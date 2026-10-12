# Search

How search finds things, how the index is kept up to date, what PostgreSQL needs, and which settings change its behavior.

Search covers tasks (including their comments), context blocks, tools, agents and projects. It is used by the home page (`GET /api/v1/search/query`), by the task and context block search endpoints, and by the `search` and `search_blocks` MCP tools.

The code lives in `apps/backend/src/search/index/`.

## How a search works

Three strategies each produce their own ranked list of candidates:

| Strategy | Finds | Built on |
|---|---|---|
| `keyword` | Items containing the query's words, in any word form. Title matches rank above text matches, which rank above comment matches. | PostgreSQL full-text search (`tsvector`, GIN index) |
| `fuzzy_title` | Items whose title looks like the query, despite typos or a partial word. | `pg_trgm` word similarity (GIN index) |
| `semantic` | Passages that mean something close to the query, with no word in common needed. | Embeddings in `pgvector` |

The lists are merged with reciprocal rank fusion: a result's score is the sum, over the lists it appears in, of `weight / (rrfK + position)`. Only positions are used, never the strategies' raw scores. That is what lets a task, a context block and a tool share one ranking, and what keeps the ranking independent of the embedding model.

Because fusion only looks at positions, each list has to be precise on its own. Three filters do that:

- **Keyword proximity floor** (`keywordMinDensity`): drops matches whose terms are scattered far apart in a long text.
- **Semantic similarity floor** (`semanticMinSimilarity`) and **gap** (`semanticMaxGap`): a passage must be similar enough in absolute terms, and not too far behind the best passage.
- **Fuzzy title floor** (`fuzzyMinSimilarity`).

Other rules:

- A keyword query must match all its terms. If nothing does and the query has two to six terms, it is retried with any one term left out. Longer queries are questions, and the semantic strategy answers those.
- A task found through several of its comments is one result, placed by its best hit in each list.
- An exact title match gets a small boost, and finished tasks are slightly demoted so open work wins ties.
- Equal scores are ordered by semantic position.
- If the embedding model is slow or down, the search answers without semantic matches rather than failing.

### What a result contains

Besides id, type, title and score, each result has:

- `matchedBy`: the strategies that found it.
- `matchedOn`: `title`, `content` or `comment`.
- `excerpt`: the passage or comment that matched. When only the title matched there is no passage, so the excerpt is the start of the item.
- `excerptIsComplete`: `true` when the excerpt is the item's whole text (or the whole comment). Text shorter than `excerptMaxChars` is always returned whole.

`score` is between 0 and 1 and only orders the results of one search. It is not comparable between searches.

## The index

Two tables, both derived data that can be rebuilt at any time:

- `search_documents`: one row per task, comment, context block, tool, agent and project, with its full-text vector. A comment's row points at its task as the result to open.
- `search_chunks`: the embedded passages of each row. The title is one passage; the text is split at markdown headings and then into passages of about `chunkSizeChars`. Each passage is embedded together with its title and heading path, because a passage alone often does not say what it is about.

### Keeping it up to date

- **On write**: task, context block and agent events re-index the affected item immediately, so it is searchable by keyword at once. Embedding follows in the background within seconds.
- **Sweep**: every minute, each source table is compared with the index. This catches anything an event missed, covers tools and projects (which emit no events, so they can lag by up to a minute), and is how an empty index is first filled. Existing data is indexed on the first start after the upgrade with no manual step; that first pass runs in the background, so results can be incomplete for a moment right after the upgrade.
- **Embedding worker**: claims out-of-date rows with a lease (`FOR UPDATE SKIP LOCKED`), so several backend processes share the work. A passage whose text is unchanged keeps its embedding, so appending to a long block embeds only the new part. Failures are retried with a growing delay.

A row's embeddings are out of date when its text, the embedding model, or the chunk settings changed. Changing the model selected for the Embeddings job therefore re-embeds everything by itself.

To add a new kind of searchable item, add a projection to `search-projections.ts`: a `SELECT` returning the index columns for every live item.

## PostgreSQL requirements

| Extension | Needed for | If missing |
|---|---|---|
| `pg_trgm` | Fuzzy title search | The migration fails. It ships with PostgreSQL and any database owner can enable it. |
| `vector` (pgvector) | Semantic search | The app starts and search works on keywords and fuzzy titles. Settings → Search says why semantic search is off. |

The backend creates `search_chunks` at runtime once pgvector is available, and checks again every minute, so installing the extension later needs no restart and no migration.

### Local development

`compose.yaml` builds its PostgreSQL image from `dev/postgres/Dockerfile`: the same `postgres:16-alpine` as before with pgvector compiled in. To upgrade an existing local database:

```bash
docker compose up -d --build postgres
```

The data volume is kept. The image stays on Alpine on purpose: the official `pgvector/pgvector` image is Debian, and opening a data directory created on Alpine there changes text sort order, which can corrupt existing indexes.

### Production and other existing databases

1. Install pgvector on the PostgreSQL server (a package such as `postgresql-16-pgvector`, or an image that includes it; managed services usually have it available).
2. In the Taico database, as a superuser: `CREATE EXTENSION vector;`
   The extension is not marked trusted, so the application's own role can only do this itself if it is a superuser.
3. Nothing else. Within a minute the backend notices, creates its table and starts embedding.

The order does not matter: deploying the new backend before pgvector is installed is safe.

## Settings

Settings → Search shows the state of the index and every setting below. They are stored in one row and apply to all backend processes immediately. The API is `GET` / `PATCH` / `DELETE /api/v1/search/settings`, `GET /api/v1/search/index` and `POST /api/v1/search/index/rebuild`; changes need the `search:configure` scope.

| Setting | Default | What it does |
|---|---|---|
| `semanticEnabled` | `true` | Use embeddings at all. |
| `queryInstruction` | retrieval instruction | Sent with each query to instruction-aware models (Qwen3, E5). Empty for models that take none. |
| `queryEmbeddingTimeoutMs` | `2000` | How long a search waits for the query embedding. |
| `semanticMinSimilarity` | `0.45` | Semantic similarity floor. Depends on the embedding model. |
| `semanticMaxGap` | `0.15` | Allowed distance behind the best semantic match. `1` turns it off. |
| `keywordMinDensity` | `0.005` | Keyword proximity floor. `0` turns it off. |
| `fuzzyMinSimilarity` | `0.5` | Fuzzy title floor. |
| `keywordWeight`, `semanticWeight`, `fuzzyTitleWeight` | `1` | Weight of each list. `0` turns the strategy off. |
| `rrfK` | `60` | Fusion constant. |
| `candidatesPerStrategy` | `50` | Candidates each strategy contributes. |
| `exactTitleBoost` | `0.02` | Added for an exact title match; half for a title starting with the query. |
| `doneTaskMultiplier` | `0.9` | Score multiplier for finished tasks. |
| `chunkSizeChars` | `1600` | Target passage size. Changing it re-embeds everything. |
| `chunkOverlapChars` | `200` | Overlap when one long paragraph is cut. Changing it re-embeds everything. |
| `excerptMaxChars` | `1200` | Longest excerpt; shorter text is returned whole. |
| `defaultLimit` | `10` | Results when a search does not ask for a number. |

### Tuning for a different embedding model

The defaults were tuned with Qwen3-Embedding-0.6B, where unrelated text scores below about 0.3, loosely related text 0.45–0.5, and good matches 0.5–0.7. Other models use a different range, so `semanticMinSimilarity` is the first thing to revisit after changing model:

- Loosely related results showing up: raise it.
- Questions that should find something return nothing: lower it.

## Limits

- Results are not filtered per user; search has the same visibility as the list endpoints.
- Nearest-neighbour indexes are only built for embeddings of up to 2000 dimensions. Larger ones are searched by scanning every passage.
- A context block's passages carry the block's own title and headings, not the titles of its parent blocks.
- The actor and project pickers still use the small in-memory fuzzy matcher (`SearchService`); those lists are short.
