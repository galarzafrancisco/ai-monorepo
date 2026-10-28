import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ThreadEntity } from '../thread.entity';
import { ThreadWatchKind } from './thread-watch.enums';

/**
 * A thread waiting to hear about something outside it (a pull request today).
 * One per thread and target: watching again updates it.
 */
@Entity({ name: 'thread_watches' })
@Index('UQ_thread_watches_target', ['threadId', 'kind', 'targetId'], { unique: true })
@Index('IDX_thread_watches_kind_target', ['kind', 'targetId'])
export class ThreadWatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Column({ type: 'text', enum: ThreadWatchKind })
  kind!: ThreadWatchKind;

  /** The watched thing's id in its own table (pull_requests.id). */
  @Column({ type: 'uuid', name: 'target_id' })
  targetId!: string;

  /** How to show the target in lists, e.g. "acme/api#12". */
  @Column({ type: 'text', name: 'target_label' })
  targetLabel!: string;

  @Column({ type: 'text', nullable: true, name: 'target_url' })
  targetUrl!: string | null;

  /** What to tell the agent about, in the kind's own vocabulary (e.g. "checks_failed"). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  conditions!: string[];

  /** Stop after the first notification, instead of watching until the target finishes or the watch expires. */
  @Column({ type: 'boolean', default: true })
  once!: boolean;

  /** What the user wants, in the agent's words. Repeated back in each notification. */
  @Column({ type: 'text', nullable: true, name: 'waiting_for' })
  waitingFor!: string | null;

  /** Who the agent was answering when it started watching; notification turns act on their behalf. */
  @Column({ type: 'uuid', name: 'subscribed_for_actor_id' })
  subscribedForActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'subscribed_for_actor_id' })
  subscribedForActor?: ActorEntity;

  /** Every watch ends: nothing is polled forever. */
  @Index('IDX_thread_watches_expires_at')
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
