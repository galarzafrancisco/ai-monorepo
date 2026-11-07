import { AgentType } from 'src/agents/enums';
import type { WorkerCapabilities } from '@taico/events';
import { RegisteredClientEntity } from 'src/authorization-server/entities/registered-client.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

/** A worker is registered once per workspace it works in. */
@Entity({ name: 'workers' })
@Index('UQ_workers_workspace_oauth_client', ['workspaceId', 'oauthClientId'], {
  unique: true,
})
export class WorkerEntity {
  /** The workspace of the token the worker connected with. See docs/architecture/workspaces.md. */
  @Index()
  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'oauth_client_id' })
  oauthClientId!: string;

  @ManyToOne(() => RegisteredClientEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'oauth_client_id', referencedColumnName: 'clientId' })
  oauthClient?: RegisteredClientEntity;

  @Column({ type: 'timestamptz', name: 'last_seen_at' })
  lastSeenAt!: Date;

  @Column({ type: 'text', name: 'worker_version', nullable: true })
  workerVersion!: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  harnesses!: AgentType[];

  @Column({ type: 'simple-json', nullable: true })
  capabilities!: WorkerCapabilities | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
