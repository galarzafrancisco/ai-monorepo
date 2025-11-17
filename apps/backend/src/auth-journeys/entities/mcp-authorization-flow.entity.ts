import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { McpServerEntity } from '../../mcp-registry/entities/mcp-server.entity';
import { RegisteredClientEntity } from '../../authorization-server/registered-client.entity';
import { AuthJourneyEntity } from './auth-journey.entity';
import { McpAuthorizationFlowStatus } from '../enums/mcp-authorization-flow-status.enum';


@Entity('mcp_authorization_flows')
export class McpAuthorizationFlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'authorization_journey_id' })
  authorizationJourneyId!: string;

  @Column({ type: 'uuid', name: 'server_id' })
  serverId!: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId!: string;

  @Column({
    type: 'text',
    default: McpAuthorizationFlowStatus.CLIENT_NOT_REGISTERED,
  })
  status!: McpAuthorizationFlowStatus;

  // PKCE parameters for secure authorization
  @Column({ type: 'text', name: 'code_challenge', nullable: true })
  codeChallenge?: string;

  @Column({ type: 'varchar', length: 10, name: 'code_challenge_method', nullable: true })
  codeChallengeMethod?: string;

  // OAuth state parameter for CSRF protection
  @Column({ type: 'text', name: 'state', nullable: true })
  state?: string;

  // Redirect URI from authorization request
  @Column({ type: 'text', name: 'redirect_uri', nullable: true })
  redirectUri?: string;

  // Scopes requested
  @Column({ type: 'text', name: 'scope', nullable: true })
  scope?: string;

  // Resource server URL the client wants to access
  @Column({ type: 'text', name: 'resource', nullable: true })
  resource?: string;

  // Authorization code generated after user consent
  @Column({ type: 'text', name: 'authorization_code', nullable: true })
  authorizationCode?: string;

  // Authorization code expiry timestamp
  @Column({ type: 'datetime', name: 'authorization_code_expires_at', nullable: true })
  authorizationCodeExpiresAt?: Date;

  // Whether the authorization code has been used (single-use)
  @Column({ type: 'boolean', name: 'authorization_code_used', default: false })
  authorizationCodeUsed!: boolean;

  // An MCP Authorization Flow links to only one Journey
  @OneToOne(() => AuthJourneyEntity)
  @JoinColumn({ name: 'authorization_journey_id' })
  authJourney!: AuthJourneyEntity;

  // An MCP Authorization Flow refers to only one MCP Server
  @ManyToOne(() => McpServerEntity, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'server_id' })
  server!: McpServerEntity;

  // An MCP Authorization Flow refers to only one MCP Client
  @OneToOne(() => RegisteredClientEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_id' })
  client!: RegisteredClientEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
