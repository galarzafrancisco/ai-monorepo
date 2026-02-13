import { MigrationInterface, QueryRunner } from 'typeorm';

type SqliteColumnInfo = { name: string };

export class RenameConnectionAuthColumns1700000000002
  implements MigrationInterface
{
  name = 'RenameConnectionAuthColumns1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnNames = await this.getColumnNames(queryRunner);
    await this.renameColumns(queryRunner, columnNames, [
      ['authorizationCode', 'authorization_code'],
      ['accessToken', 'access_token'],
      ['refreshToken', 'refresh_token'],
      ['tokenExpiresAt', 'token_expires_at'],
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columnNames = await this.getColumnNames(queryRunner);
    await this.renameColumns(queryRunner, columnNames, [
      ['authorization_code', 'authorizationCode'],
      ['access_token', 'accessToken'],
      ['refresh_token', 'refreshToken'],
      ['token_expires_at', 'tokenExpiresAt'],
    ]);
  }

  private async getColumnNames(queryRunner: QueryRunner): Promise<Set<string>> {
    const columns = (await queryRunner.query(
      `PRAGMA table_info('connection_authorization_flows')`,
    )) as SqliteColumnInfo[];
    return new Set(columns.map((column) => column.name));
  }

  private async renameColumns(
    queryRunner: QueryRunner,
    columnNames: Set<string>,
    renames: Array<[string, string]>,
  ): Promise<void> {
    for (const [fromName, toName] of renames) {
      if (columnNames.has(fromName) && !columnNames.has(toName)) {
        await queryRunner.query(
          `ALTER TABLE connection_authorization_flows RENAME COLUMN ${fromName} TO ${toName}`,
        );
        columnNames.delete(fromName);
        columnNames.add(toName);
      }
    }
  }
}
