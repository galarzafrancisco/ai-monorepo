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
import { ContextPageEntity } from './page.entity';

@Entity({ name: 'wiki_tags' })
export class ContextTagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, collation: 'NOCASE' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  color?: string;

  @ManyToMany(() => ContextPageEntity, (page) => page.tags, { onDelete: 'CASCADE' })
  pages!: ContextPageEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
