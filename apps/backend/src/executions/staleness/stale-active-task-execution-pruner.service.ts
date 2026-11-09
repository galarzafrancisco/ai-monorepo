import { TaskStatus } from '../../tasks/enums/task-status.enum';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, In, Raw } from 'typeorm';
import {
  ActiveTaskExecutionEntity,
  type ActiveTaskExecutionTagSnapshot,
} from '../active/active-task-execution.entity';
import { TagEntity } from '../../meta/tag.entity';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskExecutionHistoryEntity } from '../history/task-execution-history.entity';
import { TaskExecutionHistoryStatus } from '../history/task-execution-history-status.enum';
import { ExecutionInterruptEvent } from '../events/execution-interrupt.event';
import { ActiveExecutionsChangedEvent } from '../events/active-executions-changed.event';

const STALE_EXECUTION_INTERRUPT_ACTOR_ID = 'system';

@Injectable()
export class StaleActiveTaskExecutionPrunerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
    const prunedExecution = await this.dataSource.transaction(async (manager) => {
      const activeExecution = await manager.findOne(ActiveTaskExecutionEntity, {
        where: { id: executionId },
      });

      if (!activeExecution) {
        return null;
      }

      const task = await manager.findOne(TaskEntity, {
        where: { workspaceId: activeExecution.workspaceId, id: activeExecution.taskId },
        relations: ['tags'],
      });

      if (!task) {
        await manager.delete(ActiveTaskExecutionEntity, { id: activeExecution.id });
        return activeExecution;
      }

      // Put the task back as it was before the claim, so it runs again, but
      // only if the agent hadn't moved it on. A task it finished (Done, For
      // review) or handed to someone else is left exactly as it is: rolling
      // it back would run finished work a second time.
      if (wasLeftUnfinished(task, activeExecution)) {
        task.status = activeExecution.taskStatusBeforeClaim;
        task.assigneeActorId = activeExecution.taskAssigneeActorIdBeforeClaim;
        task.tags = await this.resolveSnapshotTags(
          manager,
          task.workspaceId,
          activeExecution.taskTagsBeforeClaim,
        );
        await manager.save(TaskEntity, task);
      }
      await manager.delete(ActiveTaskExecutionEntity, { id: activeExecution.id });
      await manager.save(
        TaskExecutionHistoryEntity,
        manager.create(TaskExecutionHistoryEntity, {
          workspaceId: activeExecution.workspaceId,
          id: activeExecution.id,
          runnerSessionId: activeExecution.runnerSessionId,
          toolCallCount: activeExecution.toolCallCount,
          taskId: activeExecution.taskId,
          claimedAt: activeExecution.claimedAt,
          transitionedAt: new Date(),
          agentActorId: activeExecution.agentActorId,
          workerClientId: activeExecution.workerClientId,
          status: TaskExecutionHistoryStatus.STALE,
          errorCode: null,
        }),
      );

      return activeExecution;
    });

    if (!prunedExecution) {
      return false;
    }

    this.eventEmitter.emit(
      ExecutionInterruptEvent.INTERNAL,
      new ExecutionInterruptEvent(
        { id: STALE_EXECUTION_INTERRUPT_ACTOR_ID },
        {
          workspaceId: prunedExecution.workspaceId,
          executionId: prunedExecution.id,
          workerClientId: prunedExecution.workerClientId,
        },
      ),
    );
    this.eventEmitter.emit(
      ActiveExecutionsChangedEvent.INTERNAL,
      new ActiveExecutionsChangedEvent(prunedExecution.workspaceId),
    );

    return true;
  }

  /** The tags a task had before it was claimed, looked up in its workspace. */
  private async resolveSnapshotTags(
    manager: EntityManager,
    workspaceId: string,
    snapshotTags: ActiveTaskExecutionTagSnapshot[],
  ): Promise<TagEntity[]> {
    if (snapshotTags.length === 0) {
      return [];
    }

    const snapshotById = new Map(snapshotTags.map((tag) => [tag.id, tag]));
    const existingById = await manager.find(TagEntity, {
      where: { workspaceId, id: In(Array.from(snapshotById.keys())) },
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
        where: {
          workspaceId,
          name: Raw((column) => `lower(${column}) = lower(:name)`, {
            name: snapshotTag.name,
          }),
        },
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

      const created = manager.create(TagEntity, {
        workspaceId,
        name: snapshotTag.name,
      });
      const saved = await manager.save(TagEntity, created);
      resolvedTags.set(snapshotTag.id, saved);
    }

    return snapshotTags
      .map((snapshotTag) => resolvedTags.get(snapshotTag.id))
      .filter((tag): tag is TagEntity => Boolean(tag));
  }
}

/**
 * Whether a stale execution's task is still where the claim left it: same
 * assignee, and its status unchanged or only moved to In progress.
 */
function wasLeftUnfinished(
  task: TaskEntity,
  execution: ActiveTaskExecutionEntity,
): boolean {
  return (
    task.assigneeActorId === execution.taskAssigneeActorIdBeforeClaim &&
    (task.status === execution.taskStatusBeforeClaim ||
      task.status === TaskStatus.IN_PROGRESS)
  );
}
