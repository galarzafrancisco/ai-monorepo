import { Injectable } from '@nestjs/common';
import { DataSource, In, QueryFailedError } from 'typeorm';
import { ContextBlockEntity } from '../../context/block.entity';
import { ActorService } from '../../identity-provider/actor.service';
import { TransactionalTagWriterService } from '../../meta/transactional-tag-writer.service';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../../threads/thread.entity';
import { CreateTaskInThreadInput } from '../dto/service/tasks.service.types';
import { TaskStatus } from '../enums';
import { TaskNotFoundError } from '../errors/tasks.errors';
import { TaskEntity } from '../task.entity';

const TASK_RELATIONS = [
  'comments',
  'comments.commenterActor',
  'artefacts',
  'inputRequests',
  'tags',
  'dependsOn',
  'assigneeActor',
  'createdByActor',
] as const;

/** Creates a child task and ensures it belongs to its parent task's thread. */
@Injectable()
export class CreateTaskInThreadUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly actorService: ActorService,
    private readonly tagWriter: TransactionalTagWriterService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    input: CreateTaskInThreadInput,
    parentTaskId: string,
  ): Promise<TaskEntity> {
    const [assignee, creator] = await Promise.all([
      input.assigneeActorId
        ? this.actorService.getActorByIdOrSlug(input.assigneeActorId)
        : Promise.resolve(null),
      this.actorService.getActorByIdOrSlug(input.createdByActorId),
    ]);
    if (input.assigneeActorId && !assignee) {
      throw new Error(`Assignee actor not found: ${input.assigneeActorId}`);
    }
    if (!creator) {
      throw new Error(`Creator actor not found: ${input.createdByActorId}`);
    }

    try {
      return await this.executeTransaction(input, parentTaskId, assignee, creator);
    } catch (error) {
      if (!this.isParentThreadUniqueViolation(error)) throw error;

      // Another request created the parent thread first. The failed transaction
      // rolled back the child task, so retrying attaches it to that thread.
      return this.executeTransaction(input, parentTaskId, assignee, creator);
    }
  }

  private async executeTransaction(
    input: CreateTaskInThreadInput,
    parentTaskId: string,
    assignee: Awaited<ReturnType<ActorService['getActorByIdOrSlug']>>,
    creator: NonNullable<
      Awaited<ReturnType<ActorService['getActorByIdOrSlug']>>
    >,
  ): Promise<TaskEntity> {
    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const threadRepository = manager.getRepository(ThreadEntity);
      const blockRepository = manager.getRepository(ContextBlockEntity);
      const parentTask = await taskRepository.findOne({
        where: { id: parentTaskId },
      });
      if (!parentTask) throw new TaskNotFoundError(parentTaskId);
      const dependencies = input.dependsOnIds?.length
        ? await taskRepository.findBy({ id: In(input.dependsOnIds) })
        : [];
      if (dependencies.length !== (input.dependsOnIds?.length ?? 0)) {
        throw new Error('One or more dependency tasks not found');
      }
      const tags = input.tagNames?.length
        ? await this.tagWriter.findOrCreate(manager, input.tagNames)
        : [];
      const task = await taskRepository.save(
        taskRepository.create({
          name: input.name,
          description: input.description,
          assigneeActorId: assignee?.id ?? null,
          sessionId: input.sessionId ?? null,
          status: TaskStatus.NOT_STARTED,
          createdByActorId: creator.id,
          tags,
          dependsOn: dependencies,
        }),
      );
      await this.tagWriter.incrementUsage(
        manager,
        tags.map((tag) => tag.id),
      );

      let thread = await threadRepository.findOne({
        where: { parentTaskId },
        relations: ['tasks', 'participants'],
      });
      if (thread) {
        if (!thread.tasks.some((existing) => existing.id === task.id)) {
          thread.tasks.push(task);
          await threadRepository.save(thread);
        }
        await this.enqueueThreadUpdate(manager, thread.id, creator.id);
      } else {
        const [stateTag] = await this.tagWriter.findOrCreate(manager, [
          'thread:state',
        ]);
        if (!stateTag)
          throw new Error('The thread state tag could not be created');
        const stateBlock = await blockRepository.save(
          blockRepository.create({
            title: 'Thread State: New thread',
            content: [
              `This thread was created to achieve task ${parentTask.name} (id ${parentTask.id}).`,
              `Parent goal: ${parentTask.description || 'No description provided.'}`,
            ].join('\n'),
            parentId: null,
            order: 0,
            createdByActorId: creator.id,
            tags: [stateTag],
          }),
        );
        thread = await threadRepository.save(
          threadRepository.create({
            title: 'New thread',
            chatSessionId: null,
            createdByActorId: creator.id,
            parentTaskId,
            stateContextBlockId: stateBlock.id,
            tasks: [parentTask, task],
            tags: [],
            referencedContextBlocks: [],
            participants: [],
          }),
        );
        await this.tagWriter.incrementUsage(manager, [stateTag.id]);
        await this.outboxWriter.enqueue(manager, {
          type: OutboxEventTypes.CONTEXT_BLOCK_CREATED,
          actorId: creator.id,
          aggregateType: 'context-block',
          aggregateId: stateBlock.id,
          payload: { blockId: stateBlock.id, actorId: creator.id },
        });
        await this.outboxWriter.enqueue(manager, {
          type: OutboxEventTypes.THREAD_CREATED,
          actorId: creator.id,
          aggregateType: 'thread',
          aggregateId: thread.id,
          payload: { threadId: thread.id, actorId: creator.id },
        });
      }

      const taskWithRelations = await taskRepository.findOne({
        where: { id: task.id },
        relations: [...TASK_RELATIONS],
      });
      if (!taskWithRelations) throw new TaskNotFoundError(task.id);
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_CREATED,
        actorId: creator.id,
        aggregateType: 'task',
        aggregateId: task.id,
        payload: { taskId: task.id, actorId: creator.id },
      });
      return taskWithRelations;
    });
  }

  private isParentThreadUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;

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

  private async enqueueThreadUpdate(
    manager: Parameters<OutboxWriterService['enqueue']>[0],
    threadId: string,
    actorId: string,
  ): Promise<void> {
    await this.outboxWriter.enqueue(manager, {
      type: OutboxEventTypes.THREAD_UPDATED,
      actorId,
      aggregateType: 'thread',
      aggregateId: threadId,
      payload: { threadId, actorId },
    });
  }
}
