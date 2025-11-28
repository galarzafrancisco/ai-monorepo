import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { WikiTagEntity } from './tag.entity';

@Entity({ name: 'wiki_pages' })
export class WikiPageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  title!: string;

  @Column('text')
  content!: string;

  @Column({ type: 'text' })
  author!: string;

  @ManyToMany(() => WikiTagEntity, (tag) => tag.pages)
  @JoinTable({
    name: 'wiki_page_tags',
    joinColumn: { name: 'page_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: WikiTagEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
