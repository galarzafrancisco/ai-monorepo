import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ChatProviderType } from './enums';
import { SecretEntity } from '../secrets/secret.entity';

@Entity({ name: 'chat_providers' })
export class ChatProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', enum: ChatProviderType })
  type!: ChatProviderType;

  @Column({ type: 'uuid', nullable: true, name: 'secret_id' })
  secretId!: string | null;

  @ManyToOne(() => SecretEntity, { nullable: true })
  @JoinColumn({ name: 'secret_id' })
  secret?: SecretEntity;

  /** Model used with this provider. Null uses the provider type's default. */
  @Column({ type: 'text', nullable: true, name: 'model_id' })
  modelId!: string | null;

  /** API base URL. Required for OpenAI-compatible providers. */
  @Column({ type: 'text', nullable: true, name: 'base_url' })
  baseUrl!: string | null;

  /** Google Cloud project for Vertex AI. Null falls back to the environment. */
  @Column({ type: 'text', nullable: true })
  project!: string | null;

  /** Google Cloud location for Vertex AI. Null falls back to the environment. */
  @Column({ type: 'text', nullable: true })
  location!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: false })
  isActive!: boolean;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
