import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadNotFoundError } from '../errors/threads.errors';
import { ThreadEntity } from '../thread.entity';

@Injectable()
export class DeleteThreadUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(threadId: string, actorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ThreadEntity);
      const thread = await repository.findOne({ where: { id: threadId } });
      if (!thread) throw new ThreadNotFoundError(threadId);
      await repository.remove(thread);
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.THREAD_DELETED,
        actorId,
        aggregateType: 'thread',
        aggregateId: threadId,
        payload: { threadId, actorId },
      });
    });
  }
}
