import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import type { ModelMessage } from 'ai';
import { ThreadEntity } from './thread.entity';

@Entity({ name: 'thread_chat_history' })
export class ThreadChatHistoryEntity {
  @PrimaryColumn({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @OneToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Column({ type: 'jsonb' })
  messages!: ModelMessage[];
}
