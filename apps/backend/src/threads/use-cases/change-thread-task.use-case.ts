import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { TaskEntity } from '../../tasks/task.entity';
import { ActorEntity } from '../../identity-provider/actor.entity';
import {
  TaskNotFoundForThreadError,
  ThreadNotFoundError,
} from '../errors/threads.errors';
import { ThreadEntity } from '../thread.entity';

@Injectable()
export class ChangeThreadTaskUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async attach(threadId: string, taskId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const threadRepository = manager.getRepository(ThreadEntity);
      const taskRepository = manager.getRepository(TaskEntity);
      const actorRepository = manager.getRepository(ActorEntity);
      const thread = await this.load(threadRepository, threadId);
      const task = await taskRepository.findOne({ where: { id: taskId } });
      if (!task) throw new TaskNotFoundForThreadError(taskId);
      let changed = false;
      if (!thread.tasks.some((existing) => existing.id === task.id)) {
        thread.tasks.push(task);
        changed = true;
      }
      if (
        task.assigneeActorId &&
        !thread.participants.some(
          (participant) => participant.id === task.assigneeActorId,
        )
      ) {
        const assignee = await actorRepository.findOne({
          where: { id: task.assigneeActorId },
        });
        if (!assignee) throw new TaskNotFoundForThreadError(taskId);
        thread.participants.push(assignee);
        changed = true;
      }
      if (changed) await threadRepository.save(thread);
      await this.enqueue(threadId, thread.createdByActorId, manager);
    });
  }

  async detach(threadId: string, taskId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ThreadEntity);
      const thread = await this.load(repository, threadId);
      if (thread.tasks.some((task) => task.id === taskId)) {
        thread.tasks = thread.tasks.filter((task) => task.id !== taskId);
        await repository.save(thread);
      }
      await this.enqueue(threadId, thread.createdByActorId, manager);
    });
  }

  private async load(
    repository: Repository<ThreadEntity>,
    threadId: string,
  ): Promise<ThreadEntity> {
    const thread = await repository.findOne({
      where: { id: threadId },
      relations: ['tasks', 'participants'],
    });
    if (!thread) throw new ThreadNotFoundError(threadId);
    return thread;
  }

  private async enqueue(
    threadId: string,
    actorId: string,
    manager: Parameters<OutboxWriterService['enqueue']>[0],
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
