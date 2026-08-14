import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { UpdateThreadInput } from '../dto/service/threads.service.types';
import { ThreadNotFoundError } from '../errors/threads.errors';
import { ThreadEntity } from '../thread.entity';

@Injectable()
export class UpdateThreadUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    threadId: string,
    input: UpdateThreadInput,
    actorId: string,
  ): Promise<ThreadEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ThreadEntity);
      const thread = await repository.findOne({ where: { id: threadId } });
      if (!thread) throw new ThreadNotFoundError(threadId);
      if (input.title !== undefined) thread.title = input.title;
      await repository.save(thread);
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.THREAD_UPDATED,
        actorId,
        aggregateType: 'thread',
        aggregateId: threadId,
        payload: { threadId, actorId },
      });
      return thread;
    });
  }
}
