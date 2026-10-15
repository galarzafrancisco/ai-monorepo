import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ThreadEntity } from '../thread.entity';
import { ThreadTimerKind } from './thread-timer.enums';

/**
 * A reminder or a recurring schedule the threads agent set for itself. A
 * reminder is a timer that fires once.
 *
 * When the timer is due, one backend process claims the firing (advances
 * `next_fire_at`, bumps `fired_count`) and queues it as a
 * `ThreadTimerFiringEntity`. The next agent turn delivers every queued firing,
 * and removes the timer once its last firing is delivered.
 */
@Entity({ name: 'thread_timers' })
@Index('IDX_thread_timers_due', ['nextFireAt'], { where: '"fired_count" < "max_iterations"' })
export class ThreadTimerEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index('IDX_thread_timers_thread')
  @Column({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Column({ type: 'text' })
  kind!: ThreadTimerKind;

  /** What the agent wants to be reminded of, in its own words. Repeated back on every firing. */
  @Column({ type: 'text' })
  reason!: string;

  /** Seconds between firings. Null for a reminder. */
  @Column({ type: 'integer', nullable: true, name: 'period_seconds' })
  periodSeconds!: number | null;

  @Column({ type: 'integer', name: 'max_iterations' })
  maxIterations!: number;

  /** Firings claimed so far. The timer is finished when it reaches `maxIterations`. */
  @Column({ type: 'integer', name: 'fired_count', default: 0 })
  firedCount!: number;

  @Column({ type: 'timestamptz', name: 'next_fire_at' })
  nextFireAt!: Date;

  /** Who the agent was answering when it set the timer; the firing turn acts on their behalf. */
  @Column({ type: 'uuid', name: 'created_for_actor_id' })
  createdForActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_for_actor_id' })
  createdForActor?: ActorEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
