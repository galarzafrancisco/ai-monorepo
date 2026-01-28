import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ManyToMany,
} from 'typeorm';
import { ContextBlockEntity } from './block.entity';

@Entity({ name: 'context_tags' })
export class ContextTagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, collation: 'NOCASE' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  color?: string;

  @ManyToMany(() => ContextBlockEntity, (block) => block.tags, { onDelete: 'CASCADE' })
  blocks!: ContextBlockEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
