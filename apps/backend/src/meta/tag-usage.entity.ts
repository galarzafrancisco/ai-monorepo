import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TagEntity } from './tag.entity';

@Entity({ name: 'tag_usage' })
@Index(['tagId'], { unique: true })
export class TagUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'tag_id' })
  tagId!: string;

  @ManyToOne(() => TagEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag!: TagEntity;

  @Column({ type: 'integer', name: 'usage_count', default: 0 })
  usageCount!: number;

  @Column({ type: 'datetime', name: 'last_used_at', nullable: true })
  lastUsedAt?: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
