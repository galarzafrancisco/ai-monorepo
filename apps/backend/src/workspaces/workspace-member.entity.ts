import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ActorEntity } from '../identity-provider/actor.entity';
import { WorkspaceEntity } from './workspace.entity';
import { WorkspaceRole } from './enums';

/**
 * An actor (person or agent) belonging to a workspace, and their role in it.
 *
 * A person may belong to several workspaces. An agent belongs to exactly one.
 */
@Entity({ name: 'workspace_members' })
@Index('UQ_workspace_members_workspace_actor', ['workspaceId', 'actorId'], {
  unique: true,
})
export class WorkspaceMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: WorkspaceEntity;

  @Index('IDX_workspace_members_actor')
  @Column({ type: 'uuid', name: 'actor_id' })
  actorId!: string;

  @ManyToOne(() => ActorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actor_id' })
  actor?: ActorEntity;

  @Column({ type: 'text', enum: WorkspaceRole, default: WorkspaceRole.MEMBER })
  role!: WorkspaceRole;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
