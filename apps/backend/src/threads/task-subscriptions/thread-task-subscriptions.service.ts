import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { TaskStatus } from '../../tasks/enums';
import { ThreadEntity } from '../thread.entity';
import { ThreadUpdatedEvent } from '../events/threads.events';

/** The statuses a subscribed thread is told about. */
export const NOTIFIED_TASK_STATUSES: readonly TaskStatus[] = [
  TaskStatus.FOR_REVIEW,
  TaskStatus.DONE,
];

export type SubscribedTask = {
  id: string;
  name: string;
  status: TaskStatus;
};

/**
 * Which threads are waiting to hear about which tasks. All state lives in
 * Postgres, so any backend process can record a status change and any other
 * can deliver it.
 */
@Injectable()
export class ThreadTaskSubscriptionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Subscribing again is harmless. Returns the task as it is now, or null when
   * there is no such task.
   */
  async subscribe(input: {
    threadId: string;
    taskId: string;
    forActorId: string;
  }): Promise<SubscribedTask | null> {
    const task = await this.findTask(input.taskId);
    if (!task) {
      return null;
    }

    await this.dataSource.query(
      `INSERT INTO thread_task_subscriptions (thread_id, task_id, subscribed_for_actor_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (thread_id, task_id)
       DO UPDATE SET subscribed_for_actor_id = EXCLUDED.subscribed_for_actor_id`,
      [input.threadId, task.id, input.forActorId],
    );
    await this.emitThreadUpdated(input.threadId, input.forActorId);

    // Read again: the task may have moved on while the subscription was being saved.
    return (await this.findTask(task.id)) ?? task;
  }

  /** Returns false when the thread was not subscribed to the task. */
  async unsubscribe(input: {
    threadId: string;
    taskId: string;
    actorId: string;
  }): Promise<boolean> {
    if (!isUuid(input.taskId)) {
      return false;
    }

    const [, removed]: [unknown, number] = await this.dataSource.query(
      `DELETE FROM thread_task_subscriptions WHERE thread_id = $1 AND task_id = $2`,
      [input.threadId, input.taskId],
    );
    if (removed === 0) {
      return false;
    }

    await this.emitThreadUpdated(input.threadId, input.actorId);
    return true;
  }

  /**
   * Records that a task reached a status its subscribers are told about.
   * Returns the threads that now have a notification waiting.
   */
  async markTriggered(task: SubscribedTask): Promise<string[]> {
    if (!NOTIFIED_TASK_STATUSES.includes(task.status)) {
      return [];
    }

    const [rows]: [Array<{ thread_id: string }>, number] = await this.dataSource.query(
      `UPDATE thread_task_subscriptions s
          SET triggered_status = $2, triggered_task_name = $3, triggered_at = now()
         FROM threads t
        WHERE s.task_id = $1 AND t.id = s.thread_id AND t.deleted_at IS NULL
        RETURNING s.thread_id`,
      [task.id, task.status, task.name],
    );

    return rows.map((row) => row.thread_id);
  }

  /**
   * A deleted task will never finish, so nobody waits for it any more. A
   * notification already waiting is kept: it is still true.
   */
  async removeForDeletedTask(taskId: string, actorId: string): Promise<void> {
    const [rows]: [Array<{ thread_id: string }>, number] = await this.dataSource.query(
      `DELETE FROM thread_task_subscriptions
        WHERE task_id = $1 AND triggered_at IS NULL
        RETURNING thread_id`,
      [taskId],
    );

    for (const row of rows) {
      await this.emitThreadUpdated(row.thread_id, actorId);
    }
  }

  /** Tells the thread's viewers that its list of subscriptions changed. */
  async emitThreadUpdated(threadId: string, actorId: string): Promise<void> {
    const thread = await this.dataSource
      .getRepository(ThreadEntity)
      .findOne({ where: { id: threadId } });
    if (!thread) {
      return;
    }

    this.eventEmitter.emit(
      ThreadUpdatedEvent.INTERNAL,
      new ThreadUpdatedEvent({ id: actorId }, thread),
    );
  }

  private async findTask(taskId: string): Promise<SubscribedTask | null> {
    if (!isUuid(taskId)) {
      return null;
    }

    const rows: SubscribedTask[] = await this.dataSource.query(
      `SELECT id, name, status FROM tasks WHERE id = $1 AND deleted_at IS NULL`,
      [taskId],
    );
    return rows[0] ?? null;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
