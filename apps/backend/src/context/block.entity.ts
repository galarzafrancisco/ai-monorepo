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
import { TagEntity } from 'src/meta/tag.entity';
import { ActorEntity } from '../identity-provider/actor.entity';

@Entity({ name: 'context_blocks' })
@Index(['parentId', 'order'])
export class ContextBlockEntity {
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

  @Column({ type: 'uuid', nullable: false, name: 'created_by_actor_id' })
  createdByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_by_actor_id' })
  createdByActor?: ActorEntity;

  @Column({ type: 'uuid', nullable: true, name: 'assignee_actor_id' })
  assigneeActorId?: string | null;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'assignee_actor_id' })
  assigneeActor?: ActorEntity;

  @ManyToMany(() => TagEntity, (tag) => tag.blocks)
  @JoinTable({
    name: 'context_block_tags',
    joinColumn: { name: 'block_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: TagEntity[];

  @ManyToOne(() => ContextBlockEntity, (block) => block.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: ContextBlockEntity | null;

  @OneToMany(() => ContextBlockEntity, (block) => block.parent)
  children!: ContextBlockEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;

  /**
   * Creator slug from the associated actor.
   * Returns null if no creator or actor not loaded.
   */
  get createdBy(): string | null {
    return this.createdByActor?.slug ?? null;
  }

  /**
   * Assignee slug from the associated actor.
   * Returns null if no assignee or actor not loaded.
   */
  get assignee(): string | null {
    return this.assigneeActor?.slug ?? null;
  }
}
