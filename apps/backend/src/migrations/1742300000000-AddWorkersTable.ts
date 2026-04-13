import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkersTable1742300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workers (
        id varchar PRIMARY KEY NOT NULL,
        oauth_client_id text NOT NULL,
        last_seen_at datetime NOT NULL,
        harnesses text NOT NULL DEFAULT '[]',
        row_version integer NOT NULL DEFAULT 1,
        created_at datetime NOT NULL DEFAULT (datetime('now')),
        updated_at datetime NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (oauth_client_id) REFERENCES registered_clients(client_id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_workers_oauth_client_id
      ON workers (oauth_client_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workers_last_seen_at
      ON workers (last_seen_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_workers_last_seen_at');
    await queryRunner.query('DROP INDEX IF EXISTS idx_workers_oauth_client_id');
    await queryRunner.query('DROP TABLE IF EXISTS workers');
  }
}
