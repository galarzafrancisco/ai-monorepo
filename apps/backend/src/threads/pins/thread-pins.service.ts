import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { ThreadEntity } from '../thread.entity';
import { ThreadNotFoundError } from '../errors/threads.errors';
import { ThreadPinnedEvent } from '../events/threads.events';
import { ThreadPinEntity } from './thread-pin.entity';

/** Which threads each actor keeps at the top of their own list. */
@Injectable()
export class ThreadPinsService {
  constructor(
    @InjectRepository(ThreadPinEntity)
    private readonly pinRepository: Repository<ThreadPinEntity>,
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Pins the thread for the actor. Pinning a pinned thread changes nothing.
   * A thread in another workspace is not found.
   */
  async pin(workspaceId: string, threadId: string, actorId: string): Promise<void> {
    await this.assertThreadInWorkspace(workspaceId, threadId);

    await this.pinRepository
      .createQueryBuilder()
      .insert()
      .values({ workspaceId, threadId, actorId })
      .orIgnore()
      .execute();

    this.emit(workspaceId, threadId, actorId, true);
  }

  /** Unpins the thread for the actor. Unpinning an unpinned thread changes nothing. */
  async unpin(workspaceId: string, threadId: string, actorId: string): Promise<void> {
    await this.assertThreadInWorkspace(workspaceId, threadId);

    await this.pinRepository.delete({ workspaceId, threadId, actorId });

    this.emit(workspaceId, threadId, actorId, false);
  }

  /** Which of these threads (in the workspace) the actor has pinned. */
  async getPinnedThreadIds(
    workspaceId: string,
    threadIds: string[],
    actorId: string,
  ): Promise<Set<string>> {
    if (threadIds.length === 0) {
      return new Set();
    }

    const rows = await this.pinRepository
      .createQueryBuilder('p')
      .select('p.thread_id', 'threadId')
      .where('p.workspace_id = :workspaceId', { workspaceId })
      .andWhere('p.actor_id = :actorId', { actorId })
      .andWhere('p.thread_id IN (:...threadIds)', { threadIds })
      .getRawMany<{ threadId: string }>();

    return new Set(rows.map((row) => row.threadId));
  }

  private async assertThreadInWorkspace(workspaceId: string, threadId: string): Promise<void> {
    const exists = await this.threadRepository.exists({
      where: { workspaceId, id: threadId },
    });
    if (!exists) {
      throw new ThreadNotFoundError(threadId);
    }
  }

  private emit(workspaceId: string, threadId: string, actorId: string, pinned: boolean): void {
    this.eventEmitter.emit(
      ThreadPinnedEvent.INTERNAL,
      new ThreadPinnedEvent({ id: actorId }, { threadId, workspaceId, actorId, pinned }),
    );
  }
}
