import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SearchEntityType } from '../search.types';
import { embeddingConfigKey } from './chunk-plan';
import { SearchEmbedderService } from './search-embedder.service';
import { SearchEmbeddingsService } from './search-embeddings.service';
import { SearchIndexerService } from './search-indexer.service';
import { SearchSettingsService } from './search-settings.service';
import { SearchVectorStoreService } from './search-vector-store.service';

export type SearchIndexStatus = {
  /** Whether searches currently use embeddings. */
  semanticActive: boolean;
  /** Why not, in words an administrator can act on. Null when active. */
  semanticInactiveReason: string | null;
  /** The model selected for the embeddings job, when there is a usable one. */
  embeddingModelId: string | null;
  /** Index rows: one per task, comment, context block, tool, agent and project. */
  documents: number;
  /** Rows whose embeddings are up to date with their text, the model and the chunk settings. */
  embedded: number;
  /** Rows waiting to be embedded, including failed ones waiting for a retry. */
  pending: number;
  /** Rows whose last embedding attempt failed. */
  failed: number;
  /** The most recent embedding error, if any row is failing. */
  lastError: string | null;
  byType: Array<{ type: SearchEntityType; documents: number; embedded: number }>;
};

/** What the settings page shows about the index, and the button that rebuilds it. */
@Injectable()
export class SearchIndexAdminService {
  private readonly logger = new Logger(SearchIndexAdminService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settingsService: SearchSettingsService,
    private readonly vectorStore: SearchVectorStoreService,
    private readonly embeddings: SearchEmbeddingsService,
    private readonly indexer: SearchIndexerService,
    private readonly embedder: SearchEmbedderService,
  ) {}

  async getStatus(): Promise<SearchIndexStatus> {
    const settings = await this.settingsService.get();
    const storageAvailable = await this.vectorStore.isAvailable();
    const model = await this.embeddings.resolveModel();

    let semanticInactiveReason: string | null = null;
    if (!settings.semanticEnabled) {
      semanticInactiveReason = 'Semantic search is turned off in the search settings.';
    } else if (!storageAvailable) {
      semanticInactiveReason =
        this.vectorStore.getUnavailableReason() ?? 'The embeddings table is not available.';
    } else if (!model) {
      semanticInactiveReason =
        'No usable embedding model is selected. Choose one for the Embeddings job in the model settings.';
    }
    const semanticActive = semanticInactiveReason === null;

    // Without a model nothing counts as embedded, whatever is left in the table.
    const configKey = semanticActive && model ? embeddingConfigKey(model.key, settings) : null;
    const rows: Array<{
      entity_type: SearchEntityType;
      documents: string;
      embedded: string;
      failed: string;
    }> = await this.dataSource.query(
      `SELECT "entity_type",
              count(*) AS documents,
              count(*) FILTER (WHERE "embedded_fingerprint" = md5("content_hash" || $1)) AS embedded,
              count(*) FILTER (
                WHERE "embed_error" IS NOT NULL
                  AND "embedded_fingerprint" IS DISTINCT FROM md5("content_hash" || $1)
              ) AS failed
       FROM "search_documents"
       GROUP BY "entity_type"
       ORDER BY "entity_type"`,
      [configKey],
    );
    const lastError: Array<{ embed_error: string }> = configKey
      ? await this.dataSource.query(
          `SELECT "embed_error" FROM "search_documents"
           WHERE "embed_error" IS NOT NULL
             AND "embedded_fingerprint" IS DISTINCT FROM md5("content_hash" || $1)
           ORDER BY "embed_retry_at" DESC NULLS LAST LIMIT 1`,
          [configKey],
        )
      : [];

    const total = (key: 'documents' | 'embedded' | 'failed') =>
      rows.reduce((sum, row) => sum + Number(row[key]), 0);

    return {
      semanticActive,
      semanticInactiveReason,
      embeddingModelId: model?.modelId ?? null,
      documents: total('documents'),
      embedded: total('embedded'),
      pending: semanticActive ? total('documents') - total('embedded') : 0,
      failed: semanticActive ? total('failed') : 0,
      lastError: lastError[0]?.embed_error ?? null,
      byType: rows.map((row) => ({
        type: row.entity_type,
        documents: Number(row.documents),
        embedded: Number(row.embedded),
      })),
    };
  }

  /**
   * Throws the index away and builds it again from the source tables. Keyword
   * search is complete again when this returns; embeddings follow in the
   * background.
   */
  async rebuild(): Promise<SearchIndexStatus> {
    this.logger.log({ message: 'Rebuilding the search index' });
    // Deleting the rows also deletes their embeddings (foreign key cascade).
    await this.dataSource.query(`DELETE FROM "search_documents"`);
    await this.indexer.syncAll();
    this.embedder.wake();
    return this.getStatus();
  }
}
