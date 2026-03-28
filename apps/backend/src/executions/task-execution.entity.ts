import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { TaskEntity } from '../tasks/task.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { WorkerSessionEntity } from './worker-session.entity';
import { TaskExecutionStatus } from './enums';

@Entity({ name: 'task_executions' })
@Index('idx_task_executions_task_id', ['taskId'])
@Index('idx_task_executions_agent_actor_id', ['agentActorId'])
@Index('idx_task_executions_worker_session_id', ['workerSessionId'])
@Index('idx_task_executions_status_requested_at', ['status', 'requestedAt'])
export class TaskExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => TaskEntity)
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @Column({ type: 'uuid', nullable: false, name: 'agent_actor_id' })
  agentActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'agent_actor_id' })
  agentActor?: ActorEntity;

  @Column({
    type: 'text',
    enum: TaskExecutionStatus,
    default: TaskExecutionStatus.READY,
  })
  status!: TaskExecutionStatus;

  @Column({ type: 'datetime', nullable: false, name: 'requested_at' })
  requestedAt!: Date;

  @Column({ type: 'datetime', nullable: true, name: 'claimed_at' })
  claimedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, name: 'started_at' })
  startedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, name: 'finished_at' })
  finishedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'worker_session_id' })
  workerSessionId!: string | null;

  @ManyToOne(() => WorkerSessionEntity)
  @JoinColumn({ name: 'worker_session_id' })
  workerSession?: WorkerSessionEntity | null;

  @Column({ type: 'datetime', nullable: true, name: 'lease_expires_at' })
  leaseExpiresAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, name: 'stop_requested_at' })
  stopRequestedAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason!: string | null;

  @Column({ type: 'text', nullable: true, name: 'trigger_reason' })
  triggerReason!: string | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
