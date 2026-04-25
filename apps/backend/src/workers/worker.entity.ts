import { AgentType } from 'src/agents/enums';
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
} from 'typeorm';

@Entity({ name: 'workers' })
export class WorkerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'oauth_client_id', unique: true })
  oauthClientId!: string;

  @ManyToOne(() => RegisteredClientEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'oauth_client_id', referencedColumnName: 'clientId' })
  oauthClient?: RegisteredClientEntity;

  @Column({ type: 'datetime', name: 'last_seen_at' })
  lastSeenAt!: Date;

  @Column({ type: 'text', name: 'worker_version', nullable: true })
  workerVersion!: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  harnesses!: AgentType[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
