import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../identity-provider/user.entity';
import { AiProviderEntity } from './ai-provider.entity';

/**
 * A sign-in that was started and not finished yet. Kept in the database so the
 * backend process that receives the callback need not be the one that started
 * it. Single use: deleted when the callback is handled.
 */
@Entity({ name: 'ai_provider_authorization_attempts' })
export class AiProviderAuthorizationAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'ai_provider_id' })
  aiProviderId!: string;

  @ManyToOne(() => AiProviderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ai_provider_id' })
  aiProvider?: AiProviderEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** SHA-256 of the state value, so a database read does not reveal a usable state. */
  @Index('UQ_ai_provider_authorization_attempts_state', { unique: true })
  @Column({ type: 'text', name: 'state_hash' })
  stateHash!: string;

  @Column({ type: 'text' })
  nonce!: string;

  /** Encrypted PKCE verifier. */
  @Column({ type: 'text', name: 'code_verifier' })
  codeVerifier!: string;

  /** Exactly what was sent to the provider; the code exchange must repeat it. */
  @Column({ type: 'text', name: 'redirect_uri' })
  redirectUri!: string;

  /** Client id sent in the request: the shared registration client, or the one issued earlier. */
  @Column({ type: 'text', name: 'client_id' })
  clientId!: string;

  /** True when the callback must bring a newly issued client id. */
  @Column({ type: 'boolean', name: 'is_registration' })
  isRegistration!: boolean;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
