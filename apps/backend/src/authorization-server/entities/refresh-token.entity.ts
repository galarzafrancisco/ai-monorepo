import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../identity-provider/user.entity';
import { WorkspaceEntity } from '../../workspaces/workspace.entity';

@Entity({ name: 'refresh_tokens' })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'text', name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  /**
   * The workspace the session is in, so a refresh stays there. Null for
   * tokens minted before workspace switching; refresh then uses the oldest
   * membership. Checked against membership on every refresh.
   */
  @Column({ type: 'uuid', name: 'workspace_id', nullable: true })
  workspaceId!: string | null;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: WorkspaceEntity | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
