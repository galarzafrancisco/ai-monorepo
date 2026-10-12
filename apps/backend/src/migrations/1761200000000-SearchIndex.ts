import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DROP_SEARCH_SCHEMA_STATEMENTS,
  LEXICAL_SCHEMA_STATEMENTS,
} from '../search/index/search-schema';

/**
 * The search index: one row per searchable item with a full-text vector and
 * a trigram index on its title, plus the search settings row.
 *
 * The table of embeddings is not created here. It needs the pgvector
 * extension, and the app must still start on a database without it, so the
 * search module creates it at runtime once the extension is available.
 */
export class SearchIndex1761200000000 implements MigrationInterface {
  name = 'SearchIndex1761200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of LEXICAL_SCHEMA_STATEMENTS) {
      await queryRunner.query(statement);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of DROP_SEARCH_SCHEMA_STATEMENTS) {
      await queryRunner.query(statement);
    }
  }
}
