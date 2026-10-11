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
import { AiProviderType } from './enums';
import { SecretEntity } from '../secrets/secret.entity';

/** Credentials and endpoint for one LLM vendor. Which model to use lives in ai_model_selections. */
@Entity({ name: 'ai_providers' })
export class AiProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', enum: AiProviderType })
  type!: AiProviderType;

  @Column({ type: 'uuid', nullable: true, name: 'secret_id' })
  secretId!: string | null;

  @ManyToOne(() => SecretEntity, { nullable: true })
  @JoinColumn({ name: 'secret_id' })
  secret?: SecretEntity;

  /** API base URL. Required for OpenAI-compatible providers. */
  @Column({ type: 'text', nullable: true, name: 'base_url' })
  baseUrl!: string | null;

  /** Google Cloud project for Vertex AI. Null falls back to the environment. */
  @Column({ type: 'text', nullable: true })
  project!: string | null;

  /** Google Cloud location for Vertex AI. Null falls back to the environment. */
  @Column({ type: 'text', nullable: true })
  location!: string | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
