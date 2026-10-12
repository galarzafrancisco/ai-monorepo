import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Client ID Metadata Documents: clients identified by a URL they host instead
 * of a registration call.
 *
 * A client can now have many authorization flows, one per authorization
 * request, so the one-flow-per-client constraint goes away. Registered clients
 * record how they became known and, for metadata documents, when the cached
 * document expires.
 */
export class McpClientIdMetadataDocuments1760700000000 implements MigrationInterface {
  name = 'McpClientIdMetadataDocuments1760700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" DROP CONSTRAINT "REL_0bf6704cedff2e876c78f69239"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_mcp_authorization_flows_client_server" ON "mcp_authorization_flows" ("client_id", "server_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" ADD "registration_method" text NOT NULL DEFAULT 'dynamic_registration'`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" ADD "metadata_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Metadata document clients and repeat authorizations cannot exist under
    // the old one-flow-per-client rule, so they are removed.
    await queryRunner.query(
      `DELETE FROM "registered_clients" WHERE "registration_method" = 'metadata_document'`,
    );
    await queryRunner.query(
      `DELETE FROM "mcp_authorization_flows" f
        WHERE EXISTS (
          SELECT 1 FROM "mcp_authorization_flows" newer
           WHERE newer."client_id" = f."client_id"
             AND (newer."created_at", newer."id") > (f."created_at", f."id")
        )`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" DROP COLUMN "metadata_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_clients" DROP COLUMN "registration_method"`,
    );
    await queryRunner.query(
      `DROP INDEX "idx_mcp_authorization_flows_client_server"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_authorization_flows" ADD CONSTRAINT "REL_0bf6704cedff2e876c78f69239" UNIQUE ("client_id")`,
    );
  }
}
