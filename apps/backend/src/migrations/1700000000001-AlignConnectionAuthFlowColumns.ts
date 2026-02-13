import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns connection_authorization_flows table columns to snake_case.
 *
 * Background:
 * - BaselineSchema creates snake_case columns (authorization_code, etc.)
 * - Old prod DBs created with synchronize=true have camelCase columns
 * - This migration renames camelCase → snake_case for compatibility
 *
 * Safe to run multiple times - checks column existence before renaming.
 */
export class AlignConnectionAuthFlowColumns1700000000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check which columns exist in the current schema
    const tableInfo: Array<{ name: string }> = await queryRunner.query(`
      PRAGMA table_info(connection_authorization_flows)
    `);

    const columnNames = new Set(tableInfo.map((col) => col.name));

    // Only rename if camelCase columns exist
    if (columnNames.has('authorizationCode')) {
      await this.renameColumn(
        queryRunner,
        'connection_authorization_flows',
        'authorizationCode',
        'authorization_code',
      );
    }

    if (columnNames.has('accessToken')) {
      await this.renameColumn(
        queryRunner,
        'connection_authorization_flows',
        'accessToken',
        'access_token',
      );
    }

    if (columnNames.has('refreshToken')) {
      await this.renameColumn(
        queryRunner,
        'connection_authorization_flows',
        'refreshToken',
        'refresh_token',
      );
    }

    if (columnNames.has('tokenExpiresAt')) {
      await this.renameColumn(
        queryRunner,
        'connection_authorization_flows',
        'tokenExpiresAt',
        'token_expires_at',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to camelCase for rollback
    const tableInfo: Array<{ name: string }> = await queryRunner.query(`
      PRAGMA table_info(connection_authorization_flows)
    `);

    const columnNames = new Set(tableInfo.map((col) => col.name));

    if (columnNames.has('authorization_code')) {
      await this.renameColumn(
        queryRunner,
        'connection_authorization_flows',
        'authorization_code',
        'authorizationCode',
      );
    }

    if (columnNames.has('access_token')) {
      await this.renameColumn(
        queryRunner,
        'connection_authorization_flows',
        'access_token',
        'accessToken',
      );
    }

    if (columnNames.has('refresh_token')) {
      await this.renameColumn(
        queryRunner,
        'connection_authorization_flows',
        'refresh_token',
        'refreshToken',
      );
    }

    if (columnNames.has('token_expires_at')) {
      await this.renameColumn(
        queryRunner,
        'connection_authorization_flows',
        'token_expires_at',
        'tokenExpiresAt',
      );
    }
  }

  /**
   * Helper to rename a column in SQLite (requires recreating the table)
   */
  private async renameColumn(
    queryRunner: QueryRunner,
    tableName: string,
    oldColumnName: string,
    newColumnName: string,
  ): Promise<void> {
    // SQLite doesn't support ALTER COLUMN RENAME directly in older versions
    // So we use ALTER TABLE ... RENAME COLUMN which is supported in SQLite 3.25.0+
    // The baseline requires SQLite 3.35+, so this is safe
    await queryRunner.query(
      `ALTER TABLE ${tableName} RENAME COLUMN ${oldColumnName} TO ${newColumnName}`,
    );
  }
}
