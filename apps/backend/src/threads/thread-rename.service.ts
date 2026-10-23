import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContextService } from '../context/context.service';
import { ThreadEntity } from './thread.entity';
import { ThreadNotFoundError } from './errors/threads.errors';
import { ThreadTitleUpdatedEvent } from './events/threads.events';

/**
 * Renames a thread. Shared by the REST endpoint and the thread agent's
 * `rename_thread` tool (kept apart from ThreadsService to avoid a dependency
 * cycle with the thread agent).
 */
@Injectable()
export class ThreadRenameService {
  private readonly logger = new Logger(ThreadRenameService.name);

  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    private readonly contextService: ContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async rename(threadId: string, title: string, actorId: string): Promise<string> {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error('Thread title must not be empty');
    }
    const thread = await this.threadRepository.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }
    thread.title = trimmed;
    await this.threadRepository.save(thread);
    this.eventEmitter.emit(
      ThreadTitleUpdatedEvent.INTERNAL,
      new ThreadTitleUpdatedEvent({ id: actorId }, { threadId, title: trimmed }),
    );
    try {
      await this.contextService.updateBlock(thread.stateContextBlockId, {
        title: `Thread State: ${trimmed}`,
      });
    } catch (error) {
      this.logger.warn({
        message: 'Failed to update thread state block title after rename',
        threadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return trimmed;
  }
}
