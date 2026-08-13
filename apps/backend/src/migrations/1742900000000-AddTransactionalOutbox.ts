import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionalOutbox1742900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id varchar PRIMARY KEY NOT NULL,
        type text NOT NULL,
        version integer NOT NULL DEFAULT 1,
        actor_id uuid,
        aggregate_type text,
        aggregate_id uuid,
        payload text NOT NULL,
        occurred_at datetime NOT NULL,
        available_at datetime NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        processing_started_at datetime,
        processed_at datetime,
        last_error text,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_outbox_events_dispatch
      ON outbox_events (processed_at, available_at, processing_started_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_outbox_events_dispatch');
    await queryRunner.query('DROP TABLE IF EXISTS outbox_events');
  }
}
