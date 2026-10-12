import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  DEFAULT_SEARCH_SETTINGS,
  SearchSettings,
  resolveSearchSettings,
} from './search-settings';

/**
 * Reads and writes the search settings row. Read from the database on every
 * call, so a change applies to all backend processes at once.
 */
@Injectable()
export class SearchSettingsService {
  private readonly logger = new Logger(SearchSettingsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async get(): Promise<SearchSettings> {
    const rows: Array<{ settings: unknown }> = await this.dataSource.query(
      `SELECT "settings" FROM "search_settings" WHERE "id" = 1`,
    );
    return resolveSearchSettings(rows[0]?.settings);
  }

  /** Changes the given settings and leaves the others as they are. */
  async update(changes: Partial<SearchSettings>): Promise<SearchSettings> {
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    this.logger.log({ message: 'Updating search settings', keys: Object.keys(defined) });

    // jsonb || jsonb merges in the database, so two concurrent updates of different keys both land.
    await this.dataSource.query(
      `INSERT INTO "search_settings" ("id", "settings") VALUES (1, $1::jsonb)
       ON CONFLICT ("id") DO UPDATE
       SET "settings" = "search_settings"."settings" || EXCLUDED."settings", "updated_at" = now()`,
      [JSON.stringify(defined)],
    );
    return this.get();
  }

  /** Back to the defaults. */
  async reset(): Promise<SearchSettings> {
    this.logger.log({ message: 'Resetting search settings' });
    await this.dataSource.query(`DELETE FROM "search_settings" WHERE "id" = 1`);
    return { ...DEFAULT_SEARCH_SETTINGS };
  }
}
