import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ThreadEntity } from '../thread.entity';

/**
 * One actor has pinned one thread. Pinned threads are listed first, for that
 * actor only: a pin never changes what anyone else sees.
 */
@Entity({ name: 'thread_pins' })
export class ThreadPinEntity {
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

  @Column({
    type: 'timestamptz',
    name: 'pinned_at',
    default: () => 'now()',
  })
  pinnedAt!: Date;
}
