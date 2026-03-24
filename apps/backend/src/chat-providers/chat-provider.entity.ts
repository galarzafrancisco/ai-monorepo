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

  @Column({ type: 'boolean', name: 'is_active', default: false })
  isActive!: boolean;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
