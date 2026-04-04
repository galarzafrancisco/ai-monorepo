import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  ActiveTaskExecutionEntity,
  type ActiveTaskExecutionTagSnapshot,
} from '../active/active-task-execution.entity';
import { TagEntity } from '../../meta/tag.entity';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskExecutionHistoryEntity } from '../history/task-execution-history.entity';
import { TaskExecutionHistoryStatus } from '../history/task-execution-history-status.enum';

@Injectable()
export class StaleActiveTaskExecutionPrunerService {
  constructor(private readonly dataSource: DataSource) {}

  async pruneExecutions(executions: ActiveTaskExecutionEntity[]): Promise<number> {
    let prunedCount = 0;
    for (const execution of executions) {
      const didPrune = await this.pruneExecutionById(execution.id);
      if (didPrune) {
        prunedCount += 1;
      }
    }
    return prunedCount;
  }

  async pruneExecutionById(executionId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const activeExecution = await manager.findOne(ActiveTaskExecutionEntity, {
        where: { id: executionId },
      });

      if (!activeExecution) {
        return false;
      }

      const task = await manager.findOne(TaskEntity, {
        where: { id: activeExecution.taskId },
        relations: ['tags'],
      });

      if (!task) {
        await manager.delete(ActiveTaskExecutionEntity, { id: activeExecution.id });
        return true;
      }

      task.status = activeExecution.taskStatusBeforeClaim;
      task.assigneeActorId = activeExecution.taskAssigneeActorIdBeforeClaim;
      task.tags = await this.resolveSnapshotTags(
        manager,
        activeExecution.taskTagsBeforeClaim,
      );

      await manager.save(TaskEntity, task);
      await manager.delete(ActiveTaskExecutionEntity, { id: activeExecution.id });
      await manager.save(
        TaskExecutionHistoryEntity,
        manager.create(TaskExecutionHistoryEntity, {
          taskId: activeExecution.taskId,
          claimedAt: activeExecution.claimedAt,
          transitionedAt: new Date(),
          agentActorId: activeExecution.agentActorId,
          workerClientId: activeExecution.workerClientId,
          status: TaskExecutionHistoryStatus.STALE,
          errorCode: null,
        }),
      );

      return true;
    });
  }

  private async resolveSnapshotTags(
    manager: EntityManager,
    snapshotTags: ActiveTaskExecutionTagSnapshot[],
  ): Promise<TagEntity[]> {
    if (snapshotTags.length === 0) {
      return [];
    }

    const snapshotById = new Map(snapshotTags.map((tag) => [tag.id, tag]));
    const existingById = await manager.find(TagEntity, {
      where: { id: In(Array.from(snapshotById.keys())) },
      withDeleted: true,
    });

    const resolvedTags = new Map(existingById.map((tag) => [tag.id, tag]));
    for (const tag of existingById) {
      if (tag.deletedAt) {
        const recovered = await manager.recover(TagEntity, tag);
        resolvedTags.set(tag.id, recovered);
      }
    }

    for (const snapshotTag of snapshotTags) {
      if (resolvedTags.has(snapshotTag.id)) {
        continue;
      }

      const byName = await manager.findOne(TagEntity, {
        where: { name: snapshotTag.name },
        withDeleted: true,
      });

      if (byName) {
        if (byName.deletedAt) {
          const recovered = await manager.recover(TagEntity, byName);
          resolvedTags.set(snapshotTag.id, recovered);
        } else {
          resolvedTags.set(snapshotTag.id, byName);
        }
        continue;
      }

      const created = manager.create(TagEntity, { name: snapshotTag.name });
      const saved = await manager.save(TagEntity, created);
      resolvedTags.set(snapshotTag.id, saved);
    }

    return snapshotTags
      .map((snapshotTag) => resolvedTags.get(snapshotTag.id))
      .filter((tag): tag is TagEntity => Boolean(tag));
  }
}
