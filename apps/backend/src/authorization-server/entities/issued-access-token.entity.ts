import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';

/**
 * Entity for tracking issued long-lived access tokens.
 * Generic design allows tokens to be issued for any actor (agents, services, etc.)
 *
 * Security considerations:
 * - jti (JWT ID) is stored for revocation tracking
 * - Tokens can be revoked by marking revokedAt
 * - Tracks who issued the token for audit purposes
 */
@Entity({ name: 'issued_access_tokens' })
export class IssuedAccessTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * The subject actor this token was issued for (maps to JWT 'sub' claim)
   */
  @Column({ type: 'uuid', name: 'subject_actor_id' })
  subjectActorId!: string;

  @ManyToOne(() => ActorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_actor_id' })
  subjectActor!: ActorEntity;

  /**
   * The actor who issued this token (typically a human)
   */
  @Column({ type: 'uuid', name: 'issued_by_actor_id' })
  issuedByActorId!: string;

  @ManyToOne(() => ActorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issued_by_actor_id' })
  issuedByActor!: ActorEntity;

  /**
   * JWT ID (jti claim) - used for token identification and revocation
   * This is stored to allow token revocation without needing the full token
   */
  @Column({ type: 'text', name: 'jti', unique: true })
  jti!: string;

  /**
   * Human-readable name for this token (e.g., "CI/CD Pipeline Token")
   */
  @Column({ type: 'text', name: 'name' })
  name!: string;

  /**
   * Scopes granted to this token
   */
  @Column({ type: 'simple-array', name: 'scopes' })
  scopes!: string[];

  /**
   * Token expiration timestamp
   */
  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt!: Date;

  /**
   * When the token was revoked (null if still active)
   */
  @Column({ type: 'datetime', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  /**
   * When the token was created
   */
  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  /**
   * When the token was last used (for audit/cleanup purposes)
   */
  @Column({ type: 'datetime', name: 'last_used_at', nullable: true })
  lastUsedAt!: Date | null;

  /**
   * Check if token is valid (not expired and not revoked)
   */
  get isValid(): boolean {
    if (this.revokedAt) return false;
    if (new Date() > this.expiresAt) return false;
    return true;
  }
}
