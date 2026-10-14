import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { User } from '../identity-provider/user.entity';
import { AiProviderEntity } from './ai-provider.entity';
import { AiProviderConnectionStatus } from './enums';

/**
 * One person's own authorization to use an AI provider, for provider types
 * that run on the person's plan instead of shared credentials.
 *
 * It belongs to a Taico user and is only ever used for that user's requests.
 * It is not a way to log in to Taico.
 */
@Entity({ name: 'ai_provider_connections' })
@Index('UQ_ai_provider_connections_provider_user', ['aiProviderId', 'userId'], {
  unique: true,
})
export class AiProviderConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'ai_provider_id' })
  aiProviderId!: string;

  @ManyToOne(() => AiProviderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ai_provider_id' })
  aiProvider?: AiProviderEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'text', enum: AiProviderConnectionStatus })
  status!: AiProviderConnectionStatus;

  /** Client id the provider issued to this installation for this person. Not a secret. */
  @Column({ type: 'text', nullable: true, name: 'external_client_id' })
  externalClientId!: string | null;

  /** Issuer and subject of the verified ID token: the identity of the connected account. */
  @Column({ type: 'text', nullable: true, name: 'external_issuer' })
  externalIssuer!: string | null;

  @Column({ type: 'text', nullable: true, name: 'external_subject' })
  externalSubject!: string | null;

  /** Shown so the person can tell which account is connected. Never used as a key. */
  @Column({ type: 'text', nullable: true, name: 'external_email' })
  externalEmail!: string | null;

  @Column({ type: 'text', nullable: true, name: 'granted_scopes' })
  grantedScopes!: string | null;

  /**
   * Encrypted JSON with the access, refresh and ID tokens. Not loaded unless
   * asked for, so it cannot reach an API response by accident.
   */
  @Column({ type: 'text', nullable: true, select: false })
  credentials!: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'access_token_expires_at',
  })
  accessTokenExpiresAt!: Date | null;

  /**
   * When the person agreed that turns nobody typed (task updates) may run on
   * their plan. Null means they have not.
   */
  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'automated_turns_allowed_at',
  })
  automatedTurnsAllowedAt!: Date | null;

  /** The provider's code for the last failed request, cleared by the next success. */
  @Column({ type: 'text', nullable: true, name: 'last_error_code' })
  lastErrorCode!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_error_at' })
  lastErrorAt!: Date | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
