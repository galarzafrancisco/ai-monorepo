import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { ThreadEntity } from '../thread.entity';
import { ThreadMessageEntity } from '../thread-message.entity';
import { ThreadNotFoundError } from '../errors/threads.errors';
import { ThreadReadEvent } from '../events/threads.events';
import { ThreadReadStateEntity } from './thread-read-state.entity';

/** Tracks which thread messages each actor has not read yet. */
@Injectable()
export class ThreadReadStateService {
  constructor(
    @InjectRepository(ThreadReadStateEntity)
    private readonly readStateRepository: Repository<ThreadReadStateEntity>,
    @InjectRepository(ThreadMessageEntity)
    private readonly threadMessageRepository: Repository<ThreadMessageEntity>,
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Marks everything in the thread so far as read by the actor. A thread in
   * another workspace is not found.
   */
  async markRead(workspaceId: string, threadId: string, actorId: string): Promise<void> {
    const exists = await this.threadRepository.exists({
      where: { workspaceId, id: threadId },
    });
    if (!exists) {
      throw new ThreadNotFoundError(threadId);
    }

    await this.readStateRepository
      .createQueryBuilder()
      .insert()
      .values({ workspaceId, threadId, actorId, lastReadAt: () => 'now()' })
      .orUpdate(['last_read_at'], ['thread_id', 'actor_id'])
      .execute();

    this.eventEmitter.emit(
      ThreadReadEvent.INTERNAL,
      new ThreadReadEvent({ id: actorId }, { threadId, workspaceId, actorId }),
    );
  }

  /**
   * Unread message count per thread for the actor. Threads with nothing unread
   * are left out of the map. The actor's own messages never count.
   */
  async getUnreadCounts(
    workspaceId: string,
    threadIds: string[],
    actorId: string,
  ): Promise<Map<string, number>> {
    if (threadIds.length === 0) {
      return new Map();
    }

    const rows = await this.threadMessageRepository
      .createQueryBuilder('m')
      .select('m.thread_id', 'threadId')
      .addSelect('COUNT(*)', 'count')
      .leftJoin(
        ThreadReadStateEntity,
        'r',
        'r.thread_id = m.thread_id AND r.actor_id = :actorId',
      )
      .where('m.workspace_id = :workspaceId')
      .andWhere('m.thread_id IN (:...threadIds)')
      .andWhere('m.created_by_actor_id <> :actorId')
      .andWhere('(r.last_read_at IS NULL OR m.created_at > r.last_read_at)')
      .setParameters({ workspaceId, actorId, threadIds })
      .groupBy('m.thread_id')
      .getRawMany<{ threadId: string; count: string }>();

    return new Map(rows.map((row) => [row.threadId, Number(row.count)]));
  }
}
