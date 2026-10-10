import { Column, CreateDateColumn, Entity, Generated, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { ModelMessage } from 'ai';
import { ThreadEntity } from './thread.entity';

@Entity({ name: 'thread_chat_history' })
@Index('IDX_thread_chat_history_thread_sequence', ['threadId', 'sequence'])
export class ThreadChatHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Column({ type: 'jsonb' })
  message!: ModelMessage;

  // Batch inserts can share a timestamp. A database-assigned sequence preserves
  // the exact SDK message order, including assistant/tool pairs within a turn.
  @Column({ type: 'bigint' })
  @Generated('increment')
  sequence!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
