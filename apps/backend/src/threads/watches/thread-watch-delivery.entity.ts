import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ThreadEntity } from '../thread.entity';
import { ThreadWatchKind } from './thread-watch.enums';

/**
 * A notification waiting to be told to the threads agent. The next turn
 * delivers it and deletes it. It outlives its watch: a watch's last
 * notification removes the watch when it is queued.
 */
@Entity({ name: 'thread_watch_deliveries' })
@Index('IDX_thread_watch_deliveries_thread', ['threadId', 'createdAt'])
export class ThreadWatchDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Column({ type: 'uuid', name: 'watch_id' })
  watchId!: string;

  @Column({ type: 'text', enum: ThreadWatchKind })
  kind!: ThreadWatchKind;

  /** The text the agent is given, already formatted by the kind's handler. */
  @Column({ type: 'text' })
  message!: string;

  /** Whom the turn that delivers it acts for. */
  @Column({ type: 'uuid', name: 'for_actor_id' })
  forActorId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
