import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ThreadEntity } from './thread.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { ThreadAgentMessageEntity } from './agent/thread-agent-message.entity';

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

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
