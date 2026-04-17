import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

@Entity({ name: 'execution_stats' })
export class ExecutionStatsEntity {
  @PrimaryColumn({ type: 'uuid', name: 'execution_id' })
  executionId!: string;

  @Column({ type: 'text', nullable: true })
  harness!: string | null;

  @Column({ type: 'text', name: 'provider_id', nullable: true })
  providerId!: string | null;

  @Column({ type: 'text', name: 'model_id', nullable: true })
  modelId!: string | null;

  @Column({ type: 'integer', name: 'input_tokens', nullable: true })
  inputTokens!: number | null;

  @Column({ type: 'integer', name: 'output_tokens', nullable: true })
  outputTokens!: number | null;

  @Column({ type: 'integer', name: 'total_tokens', nullable: true })
  totalTokens!: number | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
