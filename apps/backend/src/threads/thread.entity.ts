import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  Index,
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

// Serves the thread list: newest activity first, id as the tie-break.
@Index('IDX_threads_last_activity', ['lastActivityAt', 'id'])
@Entity({ name: 'threads' })
export class ThreadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  /**
   * Tip of the active branch in thread_agent_messages.
   *
   * `update: false`: the agent moves the head with its own SQL while a turn
   * runs, so saving a thread entity loaded earlier must never write it back.
   */
  @Column({
    type: 'uuid',
    nullable: true,
    name: 'head_agent_message_id',
    update: false,
  })
  headAgentMessageId!: string | null;

  /**
   * This thread's own provider and model. Null, the normal case, follows the
   * model selected for conversations. Not written by saving the entity.
   */
  @Column({
    type: 'uuid',
    nullable: true,
    name: 'ai_provider_id',
    update: false,
  })
  aiProviderId!: string | null;

  @Column({ type: 'text', nullable: true, name: 'model_id', update: false })
  modelId!: string | null;

  /**
   * Secret the threads agent uses to tell Taico-written tags from typed ones.
   * Read and written only by ThreadAgentLogService, with its own SQL.
   * `select: false`: it is never loaded with the thread, so it cannot end up in
   * an API response or an event.
   */
  @Column({
    type: 'text',
    nullable: true,
    name: 'secret',
    select: false,
    insert: false,
    update: false,
  })
  secret?: string | null;

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

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  /**
   * When the latest message people can see was posted; the creation time until
   * there is one. The thread list is ordered by it.
   *
   * Unlike `updatedAt`, renaming or tagging a thread does not move it, and
   * neither does anything the agent does that people are not shown.
   * `update: false`: only ThreadMessageWriterService moves it, with its own SQL.
   */
  @Column({
    type: 'timestamptz',
    name: 'last_activity_at',
    default: () => 'now()',
    update: false,
  })
  lastActivityAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
