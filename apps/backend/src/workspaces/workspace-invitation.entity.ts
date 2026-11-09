import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkspaceRole } from './enums';
import { WorkspaceEntity } from './workspace.entity';

/**
 * An invitation to join a workspace. It adds nobody by itself: the person it
 * was given to accepts it with its one-time code, from an account with the
 * invited email or by creating one. Only the code's hash is stored.
 * See docs/architecture/workspaces.md, "Invitations".
 */
@Entity({ name: 'workspace_invitations' })
@Index('UQ_workspace_invitations_code_hash', ['codeHash'], { unique: true })
@Index('IDX_workspace_invitations_workspace_email', ['workspaceId', 'email'])
export class WorkspaceInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: WorkspaceEntity;

  /** Lower-cased. */
  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text' })
  role!: WorkspaceRole;

  /** sha256 of the one-time code, hex. */
  @Column({ type: 'text', name: 'code_hash' })
  codeHash!: string;

  @Column({ type: 'uuid', name: 'invited_by_actor_id' })
  invitedByActorId!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'uuid', name: 'accepted_by_actor_id', nullable: true })
  acceptedByActorId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
