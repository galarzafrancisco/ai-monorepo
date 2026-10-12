import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Metadata document clients can authenticate at the token endpoint with a JWT
 * signed by their private key (private_key_jwt). Registered clients record
 * where their public keys are and which algorithm they sign with.
 */
export class McpClientPrivateKeyJwt1760800000000 implements MigrationInterface {
  name = 'McpClientPrivateKeyJwt1760800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "registered_clients" DROP CONSTRAINT "chk_registered_client_auth_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" ADD CONSTRAINT "chk_registered_client_auth_method" CHECK ("token_endpoint_auth_method" IN ('none', 'client_secret_basic', 'private_key_jwt'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" ADD "jwks_uri" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" ADD "jwks" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" ADD "token_endpoint_auth_signing_alg" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // These clients cannot exist under the old constraint. They are metadata
    // document clients, so they come back the next time they authorize.
    await queryRunner.query(
      `DELETE FROM "registered_clients" WHERE "token_endpoint_auth_method" = 'private_key_jwt'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" DROP COLUMN "token_endpoint_auth_signing_alg"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" DROP COLUMN "jwks"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" DROP COLUMN "jwks_uri"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" DROP CONSTRAINT "chk_registered_client_auth_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" ADD CONSTRAINT "chk_registered_client_auth_method" CHECK ("token_endpoint_auth_method" IN ('none', 'client_secret_basic'))`,
    );
  }
}
