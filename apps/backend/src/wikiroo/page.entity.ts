import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { WikiTagEntity } from './tag.entity';

@Entity({ name: 'wiki_pages' })
export class WikiPageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column('text')
  content!: string;

  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId?: string | null;

  @Column({ type: 'integer', default: 0 })
  order!: number;

  @Column({ type: 'text' })
  author!: string;

  @ManyToMany(() => WikiTagEntity, (tag) => tag.pages)
  @JoinTable({
    name: 'wiki_page_tags',
    joinColumn: { name: 'page_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: WikiTagEntity[];

  @ManyToOne(() => WikiPageEntity, page => page.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: WikiPageEntity | null;

  @OneToMany(() => WikiPageEntity, page => page.parent)
  children!: WikiPageEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
