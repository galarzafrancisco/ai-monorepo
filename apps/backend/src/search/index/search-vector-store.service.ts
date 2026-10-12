import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  MAX_ANN_INDEX_DIMENSIONS,
  VECTOR_SCHEMA_STATEMENTS,
  annIndexStatement,
} from './search-schema';

/** How long a "pgvector is not there" answer is trusted before looking again. */
const UNAVAILABLE_RECHECK_MS = 60_000;

/**
 * Owns the table of embeddings, which only exists on a database that has the
 * pgvector extension. Without it search still works on keywords and fuzzy
 * titles; installing the extension later turns semantic search on without a
 * restart.
 */
@Injectable()
export class SearchVectorStoreService {
  private readonly logger = new Logger(SearchVectorStoreService.name);
  private ready = false;
  private unavailableReason: string | null = null;
  private lastCheckedAt = 0;
  private pending: Promise<boolean> | null = null;
  private readonly indexedDimensions = new Set<number>();
  private iterativeScan = false;

  constructor(private readonly dataSource: DataSource) {}

  /** Why embeddings cannot be stored, or null when they can (or it is not known yet). */
  getUnavailableReason(): string | null {
    return this.unavailableReason;
  }

  /** True once the embeddings table exists. Creates the extension and table when it can. */
  async isAvailable(): Promise<boolean> {
    if (this.ready) {
      return true;
    }
    if (this.lastCheckedAt && Date.now() - this.lastCheckedAt < UNAVAILABLE_RECHECK_MS) {
      return false;
    }
    this.pending ??= this.ensure().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  /**
   * Whether an index scan can keep going until enough rows pass the filters
   * (pgvector 0.8+). Without it, a filtered search can come back short.
   */
  supportsIterativeScan(): boolean {
    return this.iterativeScan;
  }

  /** Makes nearest-neighbour search on this dimension use an index. Safe to call often. */
  async ensureAnnIndex(dimensions: number): Promise<void> {
    if (this.indexedDimensions.has(dimensions) || dimensions > MAX_ANN_INDEX_DIMENSIONS) {
      return;
    }
    try {
      await this.dataSource.query(annIndexStatement(dimensions));
      this.indexedDimensions.add(dimensions);
    } catch (error) {
      // Search still works without the index; it scans every passage instead.
      this.logger.warn({
        message: 'Could not create the nearest-neighbour index',
        dimensions,
        error: errorMessage(error),
      });
    }
  }

  private async ensure(): Promise<boolean> {
    this.lastCheckedAt = Date.now();
    try {
      const installed: unknown[] = await this.dataSource.query(
        `SELECT 1 FROM pg_extension WHERE extname = 'vector'`,
      );
      if (installed.length === 0) {
        const available: unknown[] = await this.dataSource.query(
          `SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`,
        );
        if (available.length === 0) {
          return this.unavailable(
            'The pgvector extension is not installed on the PostgreSQL server.',
          );
        }
        try {
          await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS vector`);
        } catch (error) {
          return this.unavailable(
            `pgvector is installed on the server but could not be enabled in this database (${errorMessage(error)}). ` +
              'A superuser has to run: CREATE EXTENSION vector;',
          );
        }
      }
      for (const statement of VECTOR_SCHEMA_STATEMENTS) {
        await this.dataSource.query(statement);
      }
    } catch (error) {
      return this.unavailable(`Could not prepare the embeddings table (${errorMessage(error)}).`);
    }

    this.iterativeScan = await this.readSupportsIterativeScan();
    this.ready = true;
    this.unavailableReason = null;
    this.logger.log({ message: 'Semantic search storage is ready' });
    return true;
  }

  private async readSupportsIterativeScan(): Promise<boolean> {
    try {
      const rows: Array<{ extversion: string }> = await this.dataSource.query(
        `SELECT extversion FROM pg_extension WHERE extname = 'vector'`,
      );
      const [major, minor] = (rows[0]?.extversion ?? '0.0').split('.').map(Number);
      return major > 0 || minor >= 8;
    } catch {
      return false;
    }
  }

  private unavailable(reason: string): false {
    if (this.unavailableReason !== reason) {
      this.logger.warn({
        message: 'Semantic search is off; keyword and fuzzy search still work',
        reason,
      });
    }
    this.unavailableReason = reason;
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
