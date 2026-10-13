import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ThreadMessageEntity } from './thread-message.entity';

export type WriteThreadMessageInput = {
  threadId: string;
  content: string;
  createdByActorId: string;
  /** The agent-log row this message shows, when the agent wrote it. */
  agentMessageId?: string | null;
};

/**
 * The only way a message enters `thread_messages`, the table of messages
 * people see in a conversation. Saving one also moves the thread's
 * `last_activity_at`, which is what the thread list is ordered by.
 *
 * The agent log (`thread_agent_messages`: tool calls, reasoning, injected
 * notifications, summaries) is written elsewhere and never moves it.
 */
@Injectable()
export class ThreadMessageWriterService {
  constructor(private readonly dataSource: DataSource) {}

  /** Saves the message and returns it with its author loaded. */
  async write(input: WriteThreadMessageInput): Promise<ThreadMessageEntity> {
    // One transaction: a listed thread is never ordered by a message that
    // does not exist, and a saved message always counts.
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(ThreadMessageEntity, {
          threadId: input.threadId,
          content: input.content,
          createdByActorId: input.createdByActorId,
          agentMessageId: input.agentMessageId ?? null,
        }),
      );

      // Raw update: it must not bump the thread's row version or updated_at.
      // GREATEST keeps the newest message when two writers commit out of order.
      await manager.query(
        `UPDATE threads t
            SET last_activity_at = GREATEST(t.last_activity_at, m.created_at)
           FROM thread_messages m
          WHERE m.id = $1 AND t.id = m.thread_id`,
        [saved.id],
      );

      return manager.findOneOrFail(ThreadMessageEntity, {
        where: { id: saved.id },
        relations: ['createdByActor'],
      });
    });
  }
}
