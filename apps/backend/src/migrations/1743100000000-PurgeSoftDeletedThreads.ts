import { MigrationInterface, QueryRunner } from 'typeorm';

export class PurgeSoftDeletedThreads1743100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM threads
      WHERE deleted_at IS NOT NULL
    `);
  }

  public async down(): Promise<void> {}
}
