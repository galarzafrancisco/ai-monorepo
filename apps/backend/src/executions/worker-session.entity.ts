import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  VersionColumn,
} from 'typeorm';
import { WorkerSessionStatus } from './enums';
import { TaskExecutionEntity } from './task-execution.entity';

@Entity({ name: 'worker_sessions' })
@Index('idx_worker_sessions_status_last_heartbeat_at', ['status', 'lastHeartbeatAt'])
@Index('idx_worker_sessions_oauth_client_id', ['oauthClientId'])
export class WorkerSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: false, name: 'oauth_client_id' })
  oauthClientId!: string;

  @Column({
    type: 'text',
    enum: WorkerSessionStatus,
    default: WorkerSessionStatus.ONLINE,
  })
  status!: WorkerSessionStatus;

  @Column({ type: 'datetime', nullable: false, name: 'connected_at' })
  connectedAt!: Date;

  @Column({ type: 'datetime', nullable: true, name: 'last_heartbeat_at' })
  lastHeartbeatAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  hostname!: string | null;

  @Column({ type: 'integer', nullable: true })
  pid!: number | null;

  @Column({ type: 'text', nullable: true })
  version!: string | null;

  @Column({ type: 'text', nullable: true })
  capabilities!: string | null;

  @Column({ type: 'text', nullable: true, name: 'last_seen_ip' })
  lastSeenIp!: string | null;

  @Column({ type: 'datetime', nullable: true, name: 'draining_at' })
  drainingAt!: Date | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => TaskExecutionEntity, (taskExecution) => taskExecution.workerSession)
  taskExecutions!: TaskExecutionEntity[];
}
