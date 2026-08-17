import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardDeleteSoftDeletedThreads1743100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Threads deleted before hard deletion retained a restrictive state-block FK.
    // Removing those historical rows lets SQLite cascade their thread-owned data.
    await queryRunner.query(`
      DELETE FROM threads
      WHERE deleted_at IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Historical soft-deleted rows cannot be restored after their data is purged.
  }
}
