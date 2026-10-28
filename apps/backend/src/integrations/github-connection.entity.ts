import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { SecretEntity } from '../secrets/secret.entity';
import { GithubAuthType } from './enums';

/**
 * Credentials Taico uses to talk to GitHub: to read pull request status for
 * everyone, and, when a project allows it, to let workers clone and push.
 *
 * The credential itself (a token, or a GitHub App's private key) lives in
 * `secrets`; this row only points at it.
 */
@Entity({ name: 'github_connections' })
export class GithubConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', name: 'auth_type', enum: GithubAuthType })
  authType!: GithubAuthType;

  /** The token (PAT) or the app's PEM private key (App). */
  @Column({ type: 'uuid', name: 'secret_id' })
  secretId!: string;

  @ManyToOne(() => SecretEntity)
  @JoinColumn({ name: 'secret_id' })
  secret?: SecretEntity;

  /** GitHub App id. Only for App connections. */
  @Column({ type: 'text', nullable: true, name: 'app_id' })
  appId!: string | null;

  /** GitHub App installation id. Only for App connections. */
  @Column({ type: 'text', nullable: true, name: 'installation_id' })
  installationId!: string | null;

  /**
   * Repository owners (users or organisations) this connection is used for
   * when a repository's project names no connection. Matched without case.
   */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  owners!: string[];

  /** Who GitHub says the connection acts as: the token's user, or the installation's account. */
  @Column({ type: 'text', nullable: true, name: 'account_login' })
  accountLogin!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_verified_at' })
  lastVerifiedAt!: Date | null;

  /** Why the last check against GitHub failed; null when it worked. */
  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError!: string | null;

  /** Shared secret GitHub signs webhook deliveries with. Created the first time someone asks for it. */
  @Column({ type: 'uuid', nullable: true, name: 'webhook_secret_id' })
  webhookSecretId!: string | null;

  /** When GitHub last delivered a correctly signed webhook through this connection. */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_webhook_at' })
  lastWebhookAt!: Date | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
