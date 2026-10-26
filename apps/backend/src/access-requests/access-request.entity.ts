import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccessRequestStatus } from './enums';

/**
 * An expression of interest submitted from the public /join page.
 * Deliberately minimal: no IP address or fingerprint is stored.
 */
@Entity('access_requests')
export class AccessRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** As typed by the visitor (trimmed). */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** Lower-cased email; unique so repeat submissions collapse into one row. */
  @Index('IDX_access_requests_email_normalized', { unique: true })
  @Column({ type: 'varchar', length: 320, name: 'email_normalized' })
  emailNormalized!: string;

  /** Answer to "What are you building with agents?" (optional). */
  @Column({ type: 'varchar', length: 280, nullable: true })
  building!: string | null;

  @Column({ type: 'varchar', length: 16, default: AccessRequestStatus.NEW })
  status!: AccessRequestStatus;

  /** How many times this email was submitted (duplicates/retries). */
  @Column({ type: 'int', default: 1, name: 'submission_count' })
  submissionCount!: number;

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
