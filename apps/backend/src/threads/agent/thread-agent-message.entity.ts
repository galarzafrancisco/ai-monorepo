import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ThreadEntity } from '../thread.entity';
import {
  THREAD_AGENT_MESSAGE_FORMAT_VERSION,
  ThreadAgentMessageKind,
  ThreadAgentMessageRole,
} from './thread-agent.enums';

/**
 * Agent-side conversation log: what the LLM sees, one row per message.
 *
 * Append-only. Rows form a tree through `parentId`; the thread's
 * `headAgentMessageId` points at the tip of the active branch and the LLM
 * context is the path from the head back to the root (or to the latest summary).
 */
@Entity({ name: 'thread_agent_messages' })
@Index('IDX_thread_agent_messages_thread_created', ['threadId', 'createdAt'])
export class ThreadAgentMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'thread_id' })
  threadId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Index('IDX_thread_agent_messages_parent')
  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId!: string | null;

  @ManyToOne(() => ThreadAgentMessageEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: ThreadAgentMessageEntity | null;

  @Column({ type: 'uuid', nullable: true, name: 'turn_id' })
  turnId!: string | null;

  @Column({ type: 'text', enum: ThreadAgentMessageRole })
  role!: ThreadAgentMessageRole;

  @Column({
    type: 'text',
    enum: ThreadAgentMessageKind,
    default: ThreadAgentMessageKind.MESSAGE,
  })
  kind!: ThreadAgentMessageKind;

  /** Who produced the row: 'user', 'model', 'backfill', 'hook:<name>', 'compaction'. */
  @Column({ type: 'text' })
  source!: string;

  /** Provider-neutral AI SDK ModelMessage, exactly as sent to / received from the model. */
  @Column({ type: 'jsonb' })
  message!: Record<string, unknown>;

  @Column({
    type: 'integer',
    name: 'format_version',
    default: THREAD_AGENT_MESSAGE_FORMAT_VERSION,
  })
  formatVersion!: number;

  @Column({ type: 'text', nullable: true, name: 'provider_type' })
  providerType!: string | null;

  @Column({ type: 'text', nullable: true, name: 'model_id' })
  modelId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  usage!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
