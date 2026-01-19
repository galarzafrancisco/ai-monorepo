import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';

/**
 * Entity for storing MCP OAuth refresh tokens.
 * Separate from web refresh tokens to maintain clear separation between
 * web authentication and MCP client authentication flows.
 *
 * Security considerations:
 * - Token is stored as a SHA-256 hash, never in plaintext
 * - Tokens are single-use and rotated on each refresh
 * - Tokens have explicit expiration and revocation tracking
 */
@Entity({ name: 'mcp_refresh_tokens' })
export class McpRefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'mcp_authorization_flow_id' })
  mcpAuthorizationFlowId!: string;

  @Column({ type: 'text', name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'text', name: 'client_id' })
  clientId!: string;

  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'datetime', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => McpAuthorizationFlowEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mcp_authorization_flow_id' })
  mcpAuthorizationFlow!: McpAuthorizationFlowEntity;
}
