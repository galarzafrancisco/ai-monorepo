import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ThreadEntity } from '../thread.entity';
import { ThreadTurnStatus } from './thread-agent.enums';

/**
 * One agent turn on a thread. The partial unique index allows a single running
 * turn per thread, which is the cross-process lock.
 */
@Entity({ name: 'thread_turns' })
@Index('UQ_thread_turns_running_thread', ['threadId'], {
  unique: true,
  where: `"status" = 'running'`,
})
export class ThreadTurnEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'thread_id' })
  threadId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Column({
    type: 'text',
    enum: ThreadTurnStatus,
    default: ThreadTurnStatus.RUNNING,
  })
  status!: ThreadTurnStatus;

  /** Conflicting claims while this turn is running, including on other instances. */
  @Column({ type: 'integer', name: 'request_count', default: 0 })
  requestCount!: number;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'started_at' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', name: 'heartbeat_at', default: () => 'now()' })
  heartbeatAt!: Date;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt!: Date | null;
}
