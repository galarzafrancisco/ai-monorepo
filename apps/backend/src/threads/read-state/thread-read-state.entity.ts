import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ThreadEntity } from '../thread.entity';

/**
 * How far one actor has read one thread. A message is unread for an actor when
 * someone else wrote it after `lastReadAt`; with no row, nothing has been read.
 *
 * `lastReadAt` is always the database clock, the same clock that stamps
 * messages, so the two can be compared exactly.
 */
@Entity({ name: 'thread_read_states' })
export class ThreadReadStateEntity {
  @PrimaryColumn({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'actor_id' })
  actorId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @ManyToOne(() => ActorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actor_id' })
  actor?: ActorEntity;

  @Column({ type: 'timestamptz', name: 'last_read_at' })
  lastReadAt!: Date;
}
