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
  Index,
} from 'typeorm';
import { ContextTagEntity } from './tag.entity';

@Entity({ name: 'wiki_pages' })
@Index(['parentId', 'order'])
export class ContextPageEntity {
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

  @ManyToMany(() => ContextTagEntity, (tag) => tag.pages)
  @JoinTable({
    name: 'wiki_page_tags',
    joinColumn: { name: 'page_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: ContextTagEntity[];

  @ManyToOne(() => ContextPageEntity, page => page.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: ContextPageEntity | null;

  @OneToMany(() => ContextPageEntity, page => page.parent)
  children!: ContextPageEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
