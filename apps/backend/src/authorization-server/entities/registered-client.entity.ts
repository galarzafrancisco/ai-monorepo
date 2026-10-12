import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
} from 'typeorm';
import {
  ClientRegistrationMethod,
  GrantType,
  TokenEndpointAuthMethod,
} from '../enums';

@Entity({ name: 'registered_clients' })
export class RegisteredClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, name: 'client_id' })
  clientId!: string;

  @Column({ type: 'text', name: 'client_secret', nullable: true })
  clientSecret!: string | null;

  @Column({ type: 'text', name: 'client_name' })
  clientName!: string;

  @Column('simple-array', { name: 'redirect_uris' })
  redirectUris!: string[];

  @Column('simple-array', { name: 'grant_types' })
  grantTypes!: GrantType[];

  @Column({
    type: 'text',
    name: 'token_endpoint_auth_method',
    enum: TokenEndpointAuthMethod,
  })
  tokenEndpointAuthMethod!: TokenEndpointAuthMethod;

  @Column('simple-array', { nullable: true })
  scopes!: string[] | null;

  @Column('simple-array', { nullable: true })
  contacts!: string[] | null;

  @Column({
    type: 'text',
    name: 'registration_method',
    default: ClientRegistrationMethod.DYNAMIC_REGISTRATION,
  })
  registrationMethod!: ClientRegistrationMethod;

  // Clients that authenticate with private_key_jwt publish their public keys
  // at a URL or inside their metadata document.
  @Column({ type: 'text', name: 'jwks_uri', nullable: true })
  jwksUri!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  jwks!: { keys: Record<string, unknown>[] } | null;

  // Signing algorithm the client declared for its assertions, if any
  @Column({
    type: 'text',
    name: 'token_endpoint_auth_signing_alg',
    nullable: true,
  })
  tokenEndpointAuthSigningAlg!: string | null;

  // Metadata document clients only: when the cached document must be fetched again
  @Column({ type: 'timestamptz', name: 'metadata_expires_at', nullable: true })
  metadataExpiresAt!: Date | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
