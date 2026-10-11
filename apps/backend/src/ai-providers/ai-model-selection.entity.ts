import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { AiProviderEntity } from './ai-provider.entity';
import { AiModelJob } from './enums';

/** Which provider and model a job uses. One row per job; a missing row means "not selected". */
@Entity({ name: 'ai_model_selections' })
export class AiModelSelectionEntity {
  @PrimaryColumn({ type: 'text', enum: AiModelJob })
  job!: AiModelJob;

  @Column({ type: 'uuid', name: 'ai_provider_id' })
  aiProviderId!: string;

  @ManyToOne(() => AiProviderEntity)
  @JoinColumn({ name: 'ai_provider_id' })
  aiProvider?: AiProviderEntity;

  /** Model id as the provider names it. Not validated against any catalogue. */
  @Column({ type: 'text', name: 'model_id' })
  modelId!: string;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
