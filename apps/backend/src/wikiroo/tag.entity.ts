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
import { WikiPageEntity } from './page.entity';

@Entity({ name: 'wiki_tags' })
export class WikiTagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, collation: 'NOCASE' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  color?: string;

  @ManyToMany(() => WikiPageEntity, (page) => page.tags, { onDelete: 'CASCADE' })
  pages!: WikiPageEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
