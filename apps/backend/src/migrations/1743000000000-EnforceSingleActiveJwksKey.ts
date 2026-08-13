import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceSingleActiveJwksKey1743000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE jwks_keys
      SET is_active = 0
      WHERE is_active = 1
        AND id NOT IN (
          SELECT id FROM jwks_keys
          WHERE is_active = 1
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_jwks_keys_single_active
      ON jwks_keys (is_active)
      WHERE is_active = 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_jwks_keys_single_active');
  }
}
