import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerifyUntilToJwksKeys1738047000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the new verify_until column
    // For existing rows, set verify_until to expires_at + 7 days (default verifying TTL)
    await queryRunner.query(`
      ALTER TABLE jwks_keys ADD COLUMN verify_until DATETIME
    `);

    // Update existing rows to set verify_until based on expires_at
    // Adding 7 days (168 hours) to the existing expires_at value
    await queryRunner.query(`
      UPDATE jwks_keys
      SET verify_until = datetime(expires_at, '+7 days')
      WHERE verify_until IS NULL
    `);

    // Make the column NOT NULL after populating existing data
    await queryRunner.query(`
      CREATE TABLE jwks_keys_new (
        id TEXT PRIMARY KEY,
        kid TEXT NOT NULL UNIQUE,
        public_key_pem TEXT NOT NULL,
        private_key_pem TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        expires_at DATETIME NOT NULL,
        verify_until DATETIME NOT NULL,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME
      )
    `);

    // Copy data to new table
    await queryRunner.query(`
      INSERT INTO jwks_keys_new (id, kid, public_key_pem, private_key_pem, algorithm, is_active, expires_at, verify_until, row_version, created_at, updated_at, deleted_at)
      SELECT id, kid, public_key_pem, private_key_pem, algorithm, is_active, expires_at, verify_until, row_version, created_at, updated_at, deleted_at
      FROM jwks_keys
    `);

    // Drop old table
    await queryRunner.query(`DROP TABLE jwks_keys`);

    // Rename new table
    await queryRunner.query(`ALTER TABLE jwks_keys_new RENAME TO jwks_keys`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate table without verify_until column
    await queryRunner.query(`
      CREATE TABLE jwks_keys_old (
        id TEXT PRIMARY KEY,
        kid TEXT NOT NULL UNIQUE,
        public_key_pem TEXT NOT NULL,
        private_key_pem TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        expires_at DATETIME NOT NULL,
        row_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        deleted_at DATETIME
      )
    `);

    // Copy data back (without verify_until)
    await queryRunner.query(`
      INSERT INTO jwks_keys_old (id, kid, public_key_pem, private_key_pem, algorithm, is_active, expires_at, row_version, created_at, updated_at, deleted_at)
      SELECT id, kid, public_key_pem, private_key_pem, algorithm, is_active, expires_at, row_version, created_at, updated_at, deleted_at
      FROM jwks_keys
    `);

    // Drop new table
    await queryRunner.query(`DROP TABLE jwks_keys`);

    // Rename old table back
    await queryRunner.query(`ALTER TABLE jwks_keys_old RENAME TO jwks_keys`);
  }
}
