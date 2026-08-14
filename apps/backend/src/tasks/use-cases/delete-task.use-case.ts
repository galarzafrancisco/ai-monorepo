import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ThreadEntity } from '../../threads/thread.entity';
import {
  TaskIsThreadParentError,
  TaskNotFoundError,
} from '../errors/tasks.errors';
import { TaskEntity } from '../task.entity';

/** Owns the guarded, durable deletion of a task. */
@Injectable()
export class DeleteTaskUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(taskId: string, actorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const task = await taskRepository.findOne({ where: { id: taskId } });
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      const parentThreadCount = await manager.count(ThreadEntity, {
        where: { parentTaskId: taskId },
      });
      if (parentThreadCount > 0) {
        throw new TaskIsThreadParentError(taskId, parentThreadCount);
      }

      await taskRepository.softRemove(task);
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_DELETED,
        actorId,
        aggregateType: 'task',
        aggregateId: taskId,
        payload: { taskId, actorId },
      });
    });
  }
}
