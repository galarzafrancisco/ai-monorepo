import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TaskEntity } from '../../tasks/task.entity';

@Entity({ name: 'execution_traces' })
@Index('idx_execution_traces_task_id', ['taskId'])
export class ExecutionTraceEntity {
  // Executions move from active to history, so there is deliberately no FK to
  // either of those tables. Their stable execution ID owns the trace.
  @PrimaryColumn({ type: 'uuid', name: 'execution_id' })
  executionId!: string;

  @PrimaryColumn({ type: 'integer' })
  sequence!: number;

  @Column({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @Column({ type: 'text' })
  harness!: string;

  @Column({ type: 'text', name: 'runner_session_id', nullable: true })
  runnerSessionId!: string | null;

  @Column({ type: 'timestamptz', name: 'emitted_at' })
  emittedAt!: Date;

  @Column({ type: 'jsonb' })
  payload!: unknown;

  @CreateDateColumn({ type: 'timestamptz', name: 'received_at' })
  receivedAt!: Date;
}
