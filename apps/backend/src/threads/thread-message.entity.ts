import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ThreadEntity } from './thread.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { ThreadAgentMessageEntity } from './agent/thread-agent-message.entity';

@Index('IDX_thread_messages_thread_created', ['threadId', 'createdAt'])
@Entity({ name: 'thread_messages' })
export class ThreadMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'thread_id' })
  threadId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Column({ type: 'text', nullable: false })
  content!: string;

  @Column({ type: 'uuid', nullable: false, name: 'created_by_actor_id' })
  createdByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_by_actor_id' })
  createdByActor?: ActorEntity;

  /** The agent-side message this user-facing message corresponds to. */
  @Column({ type: 'uuid', nullable: true, name: 'agent_message_id' })
  agentMessageId!: string | null;

  @ManyToOne(() => ThreadAgentMessageEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agent_message_id' })
  agentMessage?: ThreadAgentMessageEntity | null;

  /**
   * IANA timezone of the person who wrote the message, as their client
   * reported it (e.g. "Australia/Sydney"). Null for agent messages and for
   * clients that did not send one. Only the `get_time` tool reads it.
   */
  @Column({ type: 'text', nullable: true })
  timezone!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
