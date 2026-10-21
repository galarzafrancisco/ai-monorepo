import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { ThreadTimerEntity } from './thread-timer.entity';

/**
 * A firing of a reminder or schedule that the agent has not been told about
 * yet. One row per firing, so firings that pile up while an agent turn runs
 * are each delivered rather than overwriting each other. The row is deleted
 * in the transaction that delivers it.
 */
@Entity({ name: 'thread_timer_firings' })
@Unique('UQ_thread_timer_firings_iteration', ['timerId', 'iteration'])
@Index('IDX_thread_timer_firings_thread', ['threadId', 'firedAt'])
export class ThreadTimerFiringEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'timer_id' })
  timerId!: string;

  @ManyToOne(() => ThreadTimerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timer_id' })
  timer?: ThreadTimerEntity;

  /** Copied from the timer so a turn finds its thread's firings without a join. */
  @Column({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  /** Which firing this is, 1-based. */
  @Column({ type: 'integer' })
  iteration!: number;

  @Column({ type: 'timestamptz', name: 'fired_at', default: () => 'now()' })
  firedAt!: Date;
}
