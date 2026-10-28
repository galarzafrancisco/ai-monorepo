import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GithubConnectionEntity } from './github-connection.entity';

/**
 * Where a connection's webhook deliveries come from: one repository, or a whole
 * owner (an organization webhook, or a GitHub App installation). Taico learns
 * these from the deliveries themselves; nobody enters them. A repository with
 * a recent delivery is polled less, since GitHub tells Taico when it changes.
 */
@Entity({ name: 'github_webhook_sources' })
@Index('UQ_github_webhook_sources_target', ['connectionId', 'ownerKey', 'repoKey'], { unique: true })
export class GithubWebhookSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'connection_id' })
  connectionId!: string;

  @ManyToOne(() => GithubConnectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection?: GithubConnectionEntity;

  @Column({ type: 'text' })
  owner!: string;

  /** Null when the webhook covers every repository of the owner. */
  @Column({ type: 'text', nullable: true })
  repo!: string | null;

  /** Lower-case owner, for matching: GitHub ignores case. */
  @Column({ type: 'text', name: 'owner_key' })
  ownerKey!: string;

  /** Lower-case repository, or '' for the whole owner. */
  @Column({ type: 'text', name: 'repo_key' })
  repoKey!: string;

  @Index('IDX_github_webhook_sources_last_delivery_at')
  @Column({ type: 'timestamptz', name: 'last_delivery_at' })
  lastDeliveryAt!: Date;

  /** The X-GitHub-Event of the last delivery (`ping`, `pull_request`…). */
  @Column({ type: 'text', name: 'last_event', nullable: true })
  lastEvent!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
