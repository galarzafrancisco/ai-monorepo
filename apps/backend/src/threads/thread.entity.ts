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
import { ActorEntity } from '../identity-provider/actor.entity';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { TagEntity } from '../meta/tag.entity';
import { ThreadMessageEntity } from './thread-message.entity';

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

  @Column({ type: 'uuid', nullable: true, name: 'parent_task_id' })
  parentTaskId?: string | null;

  @ManyToOne(() => TaskEntity)
  @JoinColumn({ name: 'parent_task_id' })
  parentTask?: TaskEntity;

  @Column({ type: 'uuid', nullable: false, name: 'state_context_block_id' })
  stateContextBlockId!: string;

  @ManyToOne(() => ContextBlockEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'state_context_block_id' })
  stateContextBlock?: ContextBlockEntity;

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

  @OneToMany(() => ThreadMessageEntity, (message) => message.thread)
  messages?: ThreadMessageEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
