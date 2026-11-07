import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ActorEntity } from '../identity-provider/actor.entity';

@Entity({ name: 'secrets' })
/** Names are unique within a workspace. */
@Index('UQ_secrets_workspace_name', ['workspaceId', 'name'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class SecretEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The workspace this row belongs to. See docs/architecture/workspaces.md. */
  @Index()
  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'encrypted_value' })
  encryptedValue!: string;

  @Column({ type: 'uuid', nullable: false, name: 'created_by_actor_id' })
  createdByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_by_actor_id' })
  createdByActor?: ActorEntity;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;

  get createdBy(): string | null {
    return this.createdByActor?.slug ?? null;
  }
}
