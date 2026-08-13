import { Injectable } from '@nestjs/common';
import { DataSource, In, QueryFailedError } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ContextBlockEntity } from '../../context/block.entity';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { TaskEntity } from '../../tasks/task.entity';
import { ThreadTitleService } from '../thread-title.service';
import { CreateThreadInput } from '../dto/service/threads.service.types';
import {
  ActorNotFoundForThreadError,
  ContextBlockNotFoundError,
  ParentTaskThreadAlreadyExistsError,
  TaskNotFoundForThreadError,
} from '../errors/threads.errors';
import { ThreadEntity } from '../thread.entity';

const DEFAULT_THREAD_TITLE = 'New thread';

@Injectable()
export class CreateThreadUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
    private readonly threadTitleService: ThreadTitleService,
  ) {}

  async execute(input: CreateThreadInput): Promise<ThreadEntity> {
    const parentForTitle = input.parentTaskId
      ? await this.dataSource.getRepository(TaskEntity).findOne({
          where: { id: input.parentTaskId },
        })
      : null;
    const title =
      input.title ??
      (parentForTitle
        ? ((await this.threadTitleService.generateFromParentTask(
            parentForTitle,
          )) ?? DEFAULT_THREAD_TITLE)
        : DEFAULT_THREAD_TITLE);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const actorRepository = manager.getRepository(ActorEntity);
        const taskRepository = manager.getRepository(TaskEntity);
        const blockRepository = manager.getRepository(ContextBlockEntity);
        const threadRepository = manager.getRepository(ThreadEntity);
        const creator = await actorRepository.findOne({
          where: { id: input.createdByActorId },
        });
        if (!creator) {
          throw new ActorNotFoundForThreadError(input.createdByActorId);
        }
        const parentTask = input.parentTaskId
          ? await taskRepository.findOne({ where: { id: input.parentTaskId } })
          : null;
        if (input.parentTaskId && !parentTask) {
          throw new TaskNotFoundForThreadError(input.parentTaskId);
        }

        const [stateTag] = await this.tagWriter.findOrCreate(manager, [
          'thread:state',
        ]);
        if (!stateTag)
          throw new Error('The thread state tag could not be created');
        const stateBlock = await blockRepository.save(
          blockRepository.create({
            title: `Thread State: ${title}`,
            content: parentTask
              ? [
                  `This thread was created to achieve task ${parentTask.name} (id ${parentTask.id}).`,
                  `Parent goal: ${parentTask.description || 'No description provided.'}`,
                ].join('\n')
              : `This thread was created by @${creator.slug}.`,
            parentId: null,
            order: 0,
            createdByActorId: creator.id,
            tags: [stateTag],
          }),
        );

        const taskIds = new Set(input.taskIds ?? []);
        if (input.parentTaskId) taskIds.add(input.parentTaskId);
        const tasks = taskIds.size
          ? await taskRepository.findBy({ id: In([...taskIds]) })
          : [];
        if (tasks.length !== taskIds.size) {
          throw new TaskNotFoundForThreadError('One or more tasks not found');
        }
        const contextBlockIds = [...new Set(input.contextBlockIds ?? [])];
        const blocks = contextBlockIds.length
          ? await blockRepository.findBy({ id: In(contextBlockIds) })
          : [];
        if (blocks.length !== contextBlockIds.length) {
          throw new ContextBlockNotFoundError('One or more blocks not found');
        }
        const participantIds = [...new Set(input.participantActorIds ?? [])];
        const participants = participantIds.length
          ? await actorRepository.findBy({ id: In(participantIds) })
          : [];
        if (participants.length !== participantIds.length) {
          throw new ActorNotFoundForThreadError('One or more actors not found');
        }
        const tags = input.tagNames?.length
          ? await this.tagWriter.findOrCreate(manager, input.tagNames)
          : [];

        const thread = await threadRepository.save(
          threadRepository.create({
            title,
            chatSessionId: null,
            createdByActorId: creator.id,
            parentTaskId: input.parentTaskId ?? null,
            stateContextBlockId: stateBlock.id,
            tasks,
            tags,
            referencedContextBlocks: blocks,
            participants,
          }),
        );
        await this.tagWriter.incrementUsage(manager, [
          stateTag.id,
          ...tags.map((tag) => tag.id),
        ]);
        await this.outboxWriter.enqueue(manager, {
          type: OutboxEventTypes.THREAD_CREATED,
          actorId: creator.id,
          aggregateType: 'thread',
          aggregateId: thread.id,
          payload: { threadId: thread.id, actorId: creator.id },
        });
        return thread;
      });
    } catch (error) {
      if (this.isParentTaskUniqueViolation(error, input.parentTaskId)) {
        throw new ParentTaskThreadAlreadyExistsError(input.parentTaskId!);
      }
      throw error;
    }
  }

  private isParentTaskUniqueViolation(
    error: unknown,
    parentTaskId: string | undefined,
  ): boolean {
    if (!parentTaskId || !(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as {
      code?: string;
      message?: string;
    };
    const message = driverError?.message ?? '';
    return (
      (driverError?.code === 'SQLITE_CONSTRAINT' ||
        driverError?.code === '23505') &&
      (message.includes('uq_threads_parent_task_id_non_null') ||
        message.includes('threads.parent_task_id'))
    );
  }
}
