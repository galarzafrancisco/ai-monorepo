import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { SearchEntityType } from '../search.types';
import { PlannedChunk, embeddingConfigKey, planChunks } from './chunk-plan';
import { ResolvedEmbeddingModel, SearchEmbeddingsService } from './search-embeddings.service';
import { SearchSettings } from './search-settings';
import { SearchSettingsService } from './search-settings.service';
import { SearchVectorStoreService } from './search-vector-store.service';

const TICK_INTERVAL_MS = 30_000;
/** Index rows embedded per round. */
const DOCUMENTS_PER_BATCH = 20;
/** Passages sent to the embedding model per request. */
const TEXTS_PER_REQUEST = 64;
/** A claimed row is free for another worker again after this long, in case its worker died. */
const CLAIM_MINUTES = 5;
/** Longest wait before a failed row is tried again. */
const MAX_RETRY_MINUTES = 60;

type ClaimedDocument = {
  id: string;
  entity_type: SearchEntityType;
  title: string;
  search_title: string;
  body: string;
  content_hash: string;
};

type ExistingChunk = { id: string; text_hash: string; model: string };

/**
 * Embeds index rows in the background. Rows are claimed with a lease, so
 * several backend processes share the work without embedding anything twice.
 */
@Injectable()
export class SearchEmbedderService implements OnModuleDestroy {
  private readonly logger = new Logger(SearchEmbedderService.name);
  private running = false;
  private wakeRequested = false;
  private stopped = false;
  private wakeTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly settingsService: SearchSettingsService,
    private readonly vectorStore: SearchVectorStoreService,
    private readonly embeddings: SearchEmbeddingsService,
  ) {}

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.wakeTimer) {
      clearTimeout(this.wakeTimer);
    }
  }

  /** Asks for a run soon. Cheap to call after every write. */
  wake(): void {
    if (this.stopped) {
      return;
    }
    if (this.running) {
      this.wakeRequested = true;
      return;
    }
    this.wakeTimer ??= setTimeout(() => {
      this.wakeTimer = null;
      void this.run();
    }, 0);
  }

  @Interval(TICK_INTERVAL_MS)
  async run(): Promise<void> {
    if (this.running || this.stopped) {
      return;
    }
    this.running = true;
    try {
      do {
        this.wakeRequested = false;
        while (!this.stopped && (await this.processBatch()) > 0) {
          // Keep going until nothing is left or a batch fails.
        }
      } while (this.wakeRequested && !this.stopped);
    } catch (error) {
      this.logger.error({ message: 'Search embedding run failed', error: errorMessage(error) });
    } finally {
      this.running = false;
    }
  }

  /** Embeds up to one batch of out-of-date rows. Returns how many rows were brought up to date. */
  private async processBatch(): Promise<number> {
    const settings = await this.settingsService.get();
    if (!settings.semanticEnabled || !(await this.vectorStore.isAvailable())) {
      return 0;
    }
    const model = await this.embeddings.resolveModel();
    if (!model) {
      return 0;
    }
    const configKey = embeddingConfigKey(model.key, settings);

    const documents: ClaimedDocument[] = await this.dataSource.query(
      `WITH claimed AS (
         UPDATE "search_documents" SET "embed_claimed_until" = now() + interval '${CLAIM_MINUTES} minutes'
         WHERE "id" IN (
           SELECT "id" FROM "search_documents"
           WHERE "embedded_fingerprint" IS DISTINCT FROM md5("content_hash" || $1)
             AND ("embed_retry_at" IS NULL OR "embed_retry_at" <= now())
             AND ("embed_claimed_until" IS NULL OR "embed_claimed_until" <= now())
           ORDER BY "indexed_at"
           LIMIT ${DOCUMENTS_PER_BATCH}
           FOR UPDATE SKIP LOCKED
         )
         RETURNING "id", "entity_type", "title", "search_title", "body", "content_hash"
       )
       SELECT * FROM claimed`,
      [configKey],
    );
    if (documents.length === 0) {
      return 0;
    }

    try {
      await this.embedDocuments(documents, model, settings, configKey);
      return documents.length;
    } catch (error) {
      if (documents.length === 1) {
        await this.recordFailure(documents, errorMessage(error));
        return 0;
      }
    }

    // One row the model rejects must not hold back the rest of its batch.
    let embedded = 0;
    let failuresInARow = 0;
    for (const [index, document] of documents.entries()) {
      try {
        await this.embedDocuments([document], model, settings, configKey);
        embedded += 1;
        failuresInARow = 0;
      } catch (error) {
        failuresInARow += 1;
        // Several failures in a row mean the model is down, not that the rows are bad.
        const failed = failuresInARow >= 3 ? documents.slice(index) : [document];
        await this.recordFailure(failed, errorMessage(error));
        if (failed.length > 1) {
          break;
        }
      }
    }
    return embedded;
  }

  private async embedDocuments(
    documents: ClaimedDocument[],
    model: ResolvedEmbeddingModel,
    settings: SearchSettings,
    configKey: string,
  ): Promise<void> {
    const existing: Array<ExistingChunk & { document_id: string }> = await this.dataSource.query(
      `SELECT "id", "document_id", "text_hash", "model" FROM "search_chunks" WHERE "document_id" = ANY($1::uuid[])`,
      [documents.map((document) => document.id)],
    );

    // Passages whose text and model are unchanged keep their embedding, so
    // appending to a long block embeds only what is new.
    const plans = documents.map((document) => {
      const reusable = new Map<string, string[]>();
      const stale: string[] = [];
      for (const chunk of existing) {
        if (chunk.document_id !== document.id) {
          continue;
        }
        if (chunk.model === model.key) {
          reusable.set(chunk.text_hash, [...(reusable.get(chunk.text_hash) ?? []), chunk.id]);
        } else {
          stale.push(chunk.id);
        }
      }
      const kept: Array<{ id: string; chunk: PlannedChunk }> = [];
      const fresh: PlannedChunk[] = [];
      for (const chunk of planChunks(document, settings)) {
        const id = reusable.get(chunk.textHash)?.pop();
        if (id) {
          kept.push({ id, chunk });
        } else {
          fresh.push(chunk);
        }
      }
      const unused = [...reusable.values()].flat();
      return { document, kept, fresh, remove: [...stale, ...unused] };
    });

    const texts = plans.flatMap((plan) => plan.fresh.map((chunk) => chunk.embedText));
    const vectors: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += TEXTS_PER_REQUEST) {
      vectors.push(
        ...(await this.embeddings.embedDocuments(
          model,
          texts.slice(offset, offset + TEXTS_PER_REQUEST),
        )),
      );
    }
    if (vectors.length > 0) {
      await this.vectorStore.ensureAnnIndex(vectors[0].length);
    }

    let next = 0;
    for (const plan of plans) {
      const freshVectors = vectors.slice(next, next + plan.fresh.length);
      next += plan.fresh.length;

      await this.dataSource.transaction(async (manager) => {
        if (plan.remove.length > 0) {
          await manager.query(`DELETE FROM "search_chunks" WHERE "id" = ANY($1::uuid[])`, [
            plan.remove,
          ]);
        }
        if (plan.kept.length > 0) {
          await manager.query(
            `UPDATE "search_chunks" c SET "kind" = v.kind, "ordinal" = v.ordinal, "text" = v.text
             FROM unnest($1::uuid[], $2::text[], $3::int[], $4::text[]) AS v(id, kind, ordinal, text)
             WHERE c."id" = v.id`,
            [
              plan.kept.map((entry) => entry.id),
              plan.kept.map((entry) => entry.chunk.kind),
              plan.kept.map((entry) => entry.chunk.ordinal),
              plan.kept.map((entry) => entry.chunk.text),
            ],
          );
        }
        if (plan.fresh.length > 0) {
          await manager.query(
            `INSERT INTO "search_chunks" ("document_id", "kind", "ordinal", "text", "text_hash", "model", "dimensions", "embedding")
             SELECT $1::uuid, v.kind, v.ordinal, v.text, v.text_hash, $2, vector_dims(v.embedding::vector), v.embedding::vector
             FROM unnest($3::text[], $4::int[], $5::text[], $6::text[], $7::text[]) AS v(kind, ordinal, text, text_hash, embedding)`,
            [
              plan.document.id,
              model.key,
              plan.fresh.map((chunk) => chunk.kind),
              plan.fresh.map((chunk) => chunk.ordinal),
              plan.fresh.map((chunk) => chunk.text),
              plan.fresh.map((chunk) => chunk.textHash),
              freshVectors.map((vector) => `[${vector.join(',')}]`),
            ],
          );
        }
        // The fingerprint is built from the text that was embedded. If the row
        // changed meanwhile, it no longer matches and the row is picked up again.
        await manager.query(
          `UPDATE "search_documents"
           SET "embedded_fingerprint" = md5($2 || $3), "embed_attempts" = 0, "embed_error" = NULL,
               "embed_retry_at" = NULL, "embed_claimed_until" = NULL
           WHERE "id" = $1`,
          [plan.document.id, plan.document.content_hash, configKey],
        );
      });
    }

    this.logger.log({
      message: 'Embedded search index rows',
      documents: documents.length,
      embedded: texts.length,
      reused: plans.reduce((total, plan) => total + plan.kept.length, 0),
    });
  }

  /** Releases the rows and schedules a retry with a growing delay. */
  private async recordFailure(documents: ClaimedDocument[], message: string): Promise<void> {
    this.logger.warn({
      message: 'Embedding search index rows failed; they will be retried',
      documents: documents.length,
      error: message,
    });
    await this.dataSource.query(
      `UPDATE "search_documents"
       SET "embed_attempts" = "embed_attempts" + 1,
           "embed_error" = $2,
           "embed_claimed_until" = NULL,
           "embed_retry_at" = now() + least(power(2, "embed_attempts"), ${MAX_RETRY_MINUTES}) * interval '1 minute'
       WHERE "id" = ANY($1::uuid[])`,
      [documents.map((document) => document.id), message.slice(0, 1000)],
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
