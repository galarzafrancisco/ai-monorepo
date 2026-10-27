import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'execution_traces' })
export class ExecutionTraceEntity {
  // Executions move from active to history, so there is deliberately no FK to
  // either of those tables. Their stable execution ID owns the trace.
  @PrimaryColumn({ type: 'uuid', name: 'execution_id' })
  executionId!: string;

  @PrimaryColumn({ type: 'integer' })
  sequence!: number;

  @Column({ type: 'text' })
  harness!: string;

  @Column({ type: 'text', name: 'runner_session_id', nullable: true })
  runnerSessionId!: string | null;

  @Column({ type: 'timestamptz', name: 'emitted_at' })
  emittedAt!: Date;

  @Column({ type: 'json' })
  payload!: unknown;

  @CreateDateColumn({ type: 'timestamptz', name: 'received_at' })
  receivedAt!: Date;
}
