import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
  OneToOne,
} from 'typeorm';
import { AgentEntity } from '../../agents/agent.entity';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskExecutionHistoryErrorCode } from './task-execution-history-error-code.enum';
import { TaskExecutionHistoryStatus } from './task-execution-history-status.enum';
import { ExecutionStatsEntity } from '../stats/execution-stats.entity';

@Entity({ name: 'task_execution_history' })
export class TaskExecutionHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @Column({ type: 'datetime', name: 'claimed_at' })
  claimedAt!: Date;

  @Column({ type: 'datetime', name: 'transitioned_at' })
  transitionedAt!: Date;

  @Column({ type: 'uuid', name: 'agent_actor_id' })
  agentActorId!: string;

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_actor_id', referencedColumnName: 'actorId' })
  agent?: AgentEntity;

  @Column({ type: 'text', name: 'worker_client_id' })
  workerClientId!: string;

  @Column({ type: 'text', name: 'runner_session_id', nullable: true })
  runnerSessionId!: string | null;

  @Column({ type: 'integer', name: 'tool_call_count', default: 0 })
  toolCallCount!: number;

  @OneToOne(() => ExecutionStatsEntity, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'id', referencedColumnName: 'executionId' })
  stats!: ExecutionStatsEntity | null;

  @Column({
    type: 'text',
    enum: TaskExecutionHistoryStatus,
  })
  status!: TaskExecutionHistoryStatus;

  @Column({
    type: 'text',
    name: 'error_code',
    enum: TaskExecutionHistoryErrorCode,
    nullable: true,
  })
  errorCode!: TaskExecutionHistoryErrorCode | null;

  @Column({
    type: 'text',
    name: 'error_message',
    nullable: true,
  })
  errorMessage!: string | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
