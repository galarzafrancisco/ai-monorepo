import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'outbox_events' })
@Index('idx_outbox_events_dispatch', [
  'processedAt',
  'availableAt',
  'processingStartedAt',
])
export class OutboxEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ type: 'uuid', nullable: true, name: 'actor_id' })
  actorId!: string | null;

  @Column({ type: 'text', nullable: true, name: 'aggregate_type' })
  aggregateType!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'aggregate_id' })
  aggregateId!: string | null;

  @Column({ type: 'simple-json' })
  payload!: Record<string, unknown>;

  @Column({ type: 'datetime', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'datetime', name: 'available_at' })
  availableAt!: Date;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'datetime', nullable: true, name: 'processing_started_at' })
  processingStartedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, name: 'processed_at' })
  processedAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
