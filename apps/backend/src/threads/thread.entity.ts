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
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { ActorEntity } from '../identity-provider/actor.entity';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { TagEntity } from '../meta/tag.entity';

@Entity({ name: 'threads' })
export class ThreadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'uuid', nullable: false, name: 'created_by_actor_id' })
  createdByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_by_actor_id' })
  createdByActor?: ActorEntity;

  @ManyToMany(() => TaskEntity)
  @JoinTable({
    name: 'thread_tasks',
    joinColumn: { name: 'thread_id' },
    inverseJoinColumn: { name: 'task_id' },
  })
  tasks!: TaskEntity[];

  @ManyToMany(() => ContextBlockEntity)
  @JoinTable({
    name: 'thread_context_blocks',
    joinColumn: { name: 'thread_id' },
    inverseJoinColumn: { name: 'context_block_id' },
  })
  referencedContextBlocks!: ContextBlockEntity[];

  @ManyToMany(() => TagEntity, (tag) => tag.threads)
  @JoinTable({
    name: 'thread_tags',
    joinColumn: { name: 'thread_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: TagEntity[];

  @ManyToMany(() => ActorEntity)
  @JoinTable({
    name: 'thread_participants',
    joinColumn: { name: 'thread_id' },
    inverseJoinColumn: { name: 'actor_id' },
  })
  participants!: ActorEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
