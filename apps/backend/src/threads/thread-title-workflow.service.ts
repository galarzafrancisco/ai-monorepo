import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContextService } from '../context/context.service';
import { TaskEntity } from '../tasks/task.entity';
import { ThreadTitleUpdatedEvent } from './events/threads.events';
import { ThreadEntity } from './thread.entity';
import { ThreadTitleService } from './thread-title.service';

@Injectable()
export class ThreadTitleWorkflowService {
  private readonly logger = new Logger(ThreadTitleWorkflowService.name);
  private static readonly PLACEHOLDER_TITLE = 'new thread';

  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    private readonly threadTitleService: ThreadTitleService,
    private readonly contextService: ContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generateFromParentTask(
    thread: ThreadEntity,
    actorId: string,
    parentTask: TaskEntity,
  ): Promise<void> {
    if (!this.isPlaceholderTitle(thread.title)) return;

    const title = await this.threadTitleService.generateFromParentTask(parentTask);
    await this.applyGeneratedTitle(thread, actorId, title);
  }

  async generateFromFirstMessage(
    thread: ThreadEntity,
    actorId: string,
    message: string,
  ): Promise<void> {
    const title = await this.threadTitleService.generateFromMessage(message);
    await this.applyGeneratedTitle(thread, actorId, title);
  }

  private async applyGeneratedTitle(
    thread: ThreadEntity,
    actorId: string,
    title: string | null,
  ): Promise<void> {
    if (!title || this.isPlaceholderTitle(title)) return;

    const result = await this.threadRepository
      .createQueryBuilder()
      .update(ThreadEntity)
      .set({ title })
      .where('id = :threadId', { threadId: thread.id })
      .andWhere('LOWER(TRIM(title)) = :placeholder', {
        placeholder: ThreadTitleWorkflowService.PLACEHOLDER_TITLE,
      })
      .execute();
    if (result.affected !== 1) return;

    const updatedThread = await this.threadRepository.findOneBy({ id: thread.id });
    if (!updatedThread) {
      throw new Error(`Thread ${thread.id} disappeared after title update`);
    }
    thread.title = updatedThread.title;

    this.eventEmitter.emit(
      ThreadTitleUpdatedEvent.INTERNAL,
      new ThreadTitleUpdatedEvent(
        { id: actorId },
        { threadId: updatedThread.id, title: updatedThread.title },
      ),
    );

    try {
      await this.contextService.updateBlock(updatedThread.stateContextBlockId, {
        title: `Thread State: ${updatedThread.title}`,
      });
    } catch (error) {
      this.logger.warn({
        message:
          'Failed to update thread state block title after generating thread title',
        threadId: updatedThread.id,
        stateContextBlockId: updatedThread.stateContextBlockId,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      });
    }
  }

  private isPlaceholderTitle(title: string): boolean {
    return (
      title.trim().toLowerCase() ===
      ThreadTitleWorkflowService.PLACEHOLDER_TITLE
    );
  }
}
