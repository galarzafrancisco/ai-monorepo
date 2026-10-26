import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AccessRequestStatus = 'new' | 'reviewed';

@Entity('access_requests')
export class AccessRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** As typed by the visitor (trimmed). */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** Lower-cased email; unique so repeat submissions collapse into one row. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320, name: 'email_normalized' })
  emailNormalized!: string;

  @Column({ type: 'varchar', length: 280, nullable: true })
  building!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'new' })
  status!: AccessRequestStatus;

  /** How many times this email was submitted (duplicates/retries). */
  @Column({ type: 'int', default: 1, name: 'submission_count' })
  submissionCount!: number;

  /** SHA-256 of the client IP (not the raw IP) for abuse review only. */
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'ip_hash' })
  ipHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by_actor_id' })
  reviewedByActorId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'last_submitted_at', default: () => 'now()' })
  lastSubmittedAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
