import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import {
  BlockCreatedEvent,
  BlockDeletedEvent,
  BlockUpdatedEvent,
} from 'src/context/events/context.events';
import {
  CommentAddedEvent,
  TaskAssignedEvent,
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskStatusChangedEvent,
  TaskUpdatedEvent,
} from 'src/tasks/events/tasks.events';
import { isTypeormSchemaSyncEnabled } from 'src/config/env.config';
import { SearchResultType } from '../enums';
import { SearchEmbedderService } from './search-embedder.service';
import { LEXICAL_SCHEMA_STATEMENTS } from './search-schema';
import { SEARCH_PROJECTIONS, SearchProjection, projectionSelect } from './search-projections';

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Keeps the search index in step with the items it describes.
 *
 * Two paths do the same work at different scopes. A domain event re-indexes
 * one result right away, so new and edited items are searchable at once. A
 * periodic sweep compares every item's timestamp with its index row; it
 * catches anything an event missed (a crash, another process, a kind of item
 * that emits no events) and is also how an empty index is first filled.
 */
@Injectable()
export class SearchIndexerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SearchIndexerService.name);
  private sweeping = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly embedder: SearchEmbedderService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (isTypeormSchemaSyncEnabled()) {
      // Migrations do not run in sync mode, and these tables have no entities to sync from.
      for (const statement of LEXICAL_SCHEMA_STATEMENTS) {
        await this.dataSource.query(statement);
      }
    }
    // Not awaited: a large first backfill must not delay startup.
    void this.sweep();
  }

  @Interval(SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    if (this.sweeping) {
      return;
    }
    this.sweeping = true;
    try {
      const changed = await this.syncAll();
      if (changed > 0) {
        this.logger.log({ message: 'Search index sweep applied changes', changed });
      }
    } catch (error) {
      this.logger.error({ message: 'Search index sweep failed', error: errorMessage(error) });
    } finally {
      this.sweeping = false;
    }
    this.embedder.wake();
  }

  /** Brings every index row in line with its source. Returns how many rows changed. */
  async syncAll(): Promise<number> {
    let changed = 0;
    for (const projection of SEARCH_PROJECTIONS) {
      changed += await this.syncProjection(projection, null);
    }
    return changed;
  }

  /** Re-indexes one result and everything found through it (a task and its comments). */
  async syncResult(resultType: `${SearchResultType}`, resultId: string): Promise<void> {
    try {
      for (const projection of SEARCH_PROJECTIONS) {
        if (projection.resultType === resultType) {
          await this.syncProjection(projection, resultId);
        }
      }
    } catch (error) {
      // Indexing never fails the write that triggered it; the sweep will retry.
      this.logger.error({
        message: 'Failed to update the search index',
        resultType,
        resultId,
        error: errorMessage(error),
      });
      return;
    }
    this.embedder.wake();
  }

  private async syncProjection(
    projection: SearchProjection,
    resultId: string | null,
  ): Promise<number> {
    const scoped = resultId !== null;
    const select = projectionSelect(projection, scoped);
    const parameters = scoped ? [resultId] : [];
    const entityType = `'${projection.entityType}'`;

    // Tags live in other tables: adding, removing or renaming one changes an item's
    // keywords without touching its timestamp, so the keywords are compared as well.
    const outdated = scoped
      ? 'TRUE'
      : `d."id" IS NULL
         OR d."source_updated_at" IS DISTINCT FROM src.source_updated_at
         OR d."keywords" IS DISTINCT FROM src.keywords`;

    const upserted: Array<{ count: string }> = await this.dataSource.query(
      `WITH written AS (
         INSERT INTO "search_documents" (
           "entity_type", "entity_id", "result_type", "result_id", "title", "search_title",
           "body", "keywords", "body_weight", "meta", "source_updated_at", "content_hash"
         )
         SELECT ${entityType}, src.entity_id, '${projection.resultType}', src.result_id, src.title,
                src.search_title, src.body, src.keywords, src.body_weight, src.meta,
                src.source_updated_at,
                md5(src.title || chr(31) || src.search_title || chr(31) || src.body)
         FROM (${select}) src
         LEFT JOIN "search_documents" d
           ON d."entity_type" = ${entityType} AND d."entity_id" = src.entity_id
         WHERE ${outdated}
         ON CONFLICT ("entity_type", "entity_id") DO UPDATE SET
           "result_id" = EXCLUDED."result_id",
           "title" = EXCLUDED."title",
           "search_title" = EXCLUDED."search_title",
           "body" = EXCLUDED."body",
           "keywords" = EXCLUDED."keywords",
           "body_weight" = EXCLUDED."body_weight",
           "meta" = EXCLUDED."meta",
           "source_updated_at" = EXCLUDED."source_updated_at",
           "content_hash" = EXCLUDED."content_hash",
           "indexed_at" = now(),
           -- New text gets a fresh set of embedding attempts.
           "embed_attempts" = CASE
             WHEN "search_documents"."content_hash" = EXCLUDED."content_hash"
             THEN "search_documents"."embed_attempts" ELSE 0 END,
           "embed_retry_at" = CASE
             WHEN "search_documents"."content_hash" = EXCLUDED."content_hash"
             THEN "search_documents"."embed_retry_at" ELSE NULL END
         WHERE ("search_documents"."content_hash", "search_documents"."keywords",
                "search_documents"."meta", "search_documents"."source_updated_at",
                "search_documents"."title", "search_documents"."result_id")
               IS DISTINCT FROM
               (EXCLUDED."content_hash", EXCLUDED."keywords", EXCLUDED."meta",
                EXCLUDED."source_updated_at", EXCLUDED."title", EXCLUDED."result_id")
         RETURNING 1
       )
       SELECT count(*) AS count FROM written`,
      parameters,
    );

    const deleted: Array<{ count: string }> = await this.dataSource.query(
      `WITH removed AS (
         DELETE FROM "search_documents" d
         WHERE d."entity_type" = ${entityType}
           ${scoped ? 'AND d."result_id" = $1' : ''}
           AND NOT EXISTS (SELECT 1 FROM (${select}) src WHERE src.entity_id = d."entity_id")
         RETURNING 1
       )
       SELECT count(*) AS count FROM removed`,
      parameters,
    );

    return Number(upserted[0].count) + Number(deleted[0].count);
  }

  @OnEvent(TaskCreatedEvent.INTERNAL)
  @OnEvent(TaskUpdatedEvent.INTERNAL)
  @OnEvent(TaskAssignedEvent.INTERNAL)
  @OnEvent(TaskStatusChangedEvent.INTERNAL)
  async onTaskChanged(event: TaskCreatedEvent | TaskUpdatedEvent): Promise<void> {
    await this.syncResult('task', event.payload.id);
  }

  @OnEvent(TaskDeletedEvent.INTERNAL)
  async onTaskDeleted(event: TaskDeletedEvent): Promise<void> {
    await this.syncResult('task', event.taskId);
  }

  @OnEvent(CommentAddedEvent.INTERNAL)
  async onCommentAdded(event: CommentAddedEvent): Promise<void> {
    await this.syncResult('task', event.payload.taskId);
  }

  @OnEvent(BlockCreatedEvent.INTERNAL)
  @OnEvent(BlockUpdatedEvent.INTERNAL)
  async onBlockChanged(event: BlockCreatedEvent | BlockUpdatedEvent): Promise<void> {
    await this.syncResult('context_block', event.block.id);
  }

  @OnEvent(BlockDeletedEvent.INTERNAL)
  async onBlockDeleted(event: BlockDeletedEvent): Promise<void> {
    await this.syncResult('context_block', event.blockId);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
