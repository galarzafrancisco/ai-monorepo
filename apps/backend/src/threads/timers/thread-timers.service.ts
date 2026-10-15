import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ThreadEntity } from '../thread.entity';
import { ThreadUpdatedEvent } from '../events/threads.events';
import { ThreadTimerResult } from '../dto/service/threads.service.types';
import { ThreadTimerKind } from './thread-timer.enums';

type TimerRow = {
  id: string;
  kind: ThreadTimerKind;
  reason: string;
  period_seconds: number | null;
  max_iterations: number;
  fired_count: number;
  next_fire_at: Date;
  created_at: Date;
};

/** Most timers one sweep fires; the rest are picked up by the next sweep. */
const FIRE_BATCH_SIZE = 100;

/**
 * Reminders and recurring schedules of the threads agent. All state lives in
 * Postgres: any backend process can fire a timer, and a firing is claimed by
 * exactly one of them.
 */
// Writes that report what they changed select from a CTE, so the result is
// always plain rows whatever the driver returns for UPDATE and DELETE.
@Injectable()
export class ThreadTimersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(input: {
    threadId: string;
    kind: ThreadTimerKind;
    reason: string;
    /** Seconds between firings; null for a reminder. */
    periodSeconds: number | null;
    maxIterations: number;
    firstFireAt: Date;
    forActorId: string;
  }): Promise<ThreadTimerResult> {
    const rows: TimerRow[] = await this.dataSource.query(
      `INSERT INTO thread_timers (id, thread_id, kind, reason, period_seconds, max_iterations, next_fire_at, created_for_actor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, kind, reason, period_seconds, max_iterations, fired_count, next_fire_at, created_at`,
      [
        randomUUID(),
        input.threadId,
        input.kind,
        input.reason.trim(),
        input.periodSeconds,
        input.maxIterations,
        input.firstFireAt,
        input.forActorId,
      ],
    );
    await this.emitThreadUpdated(input.threadId, input.forActorId);
    return toResult(rows[0]);
  }

  /**
   * Cancelling a timer that is gone (finished, cancelled, or never existed) is
   * harmless. Returns false in that case.
   */
  async cancel(input: { threadId: string; timerId: string; actorId: string }): Promise<boolean> {
    if (!isUuid(input.timerId)) {
      return false;
    }

    // Firings not yet delivered go with the timer. They are deleted first, in
    // the same order a delivering turn locks things (firings, then the timer),
    // so a cancel racing a delivery waits instead of deadlocking.
    const removed: unknown[] = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM thread_timer_firings WHERE thread_id = $1 AND timer_id = $2`,
        [input.threadId, input.timerId],
      );
      return manager.query(
        `WITH removed AS (
           DELETE FROM thread_timers WHERE thread_id = $1 AND id = $2 RETURNING id
         )
         SELECT id FROM removed`,
        [input.threadId, input.timerId],
      );
    });
    if (removed.length === 0) {
      return false;
    }

    await this.emitThreadUpdated(input.threadId, input.actorId);
    return true;
  }

  /** Timers that will still fire, soonest first. */
  async listActive(threadId: string): Promise<ThreadTimerResult[]> {
    const rows: TimerRow[] = await this.dataSource.query(
      `SELECT id, kind, reason, period_seconds, max_iterations, fired_count, next_fire_at, created_at
         FROM thread_timers
        WHERE thread_id = $1 AND fired_count < max_iterations
        ORDER BY next_fire_at ASC, id ASC`,
      [threadId],
    );
    return rows.map(toResult);
  }

  /**
   * Claims every due firing and queues it for delivery. Returns the threads
   * that now have a firing waiting.
   *
   * Safe to run on many processes at once: a due timer is locked by the first
   * sweep that reaches it and skipped by the others, and claiming it moves
   * `next_fire_at` past now, so it is not due again until its next period.
   * The unique (timer, iteration) pair is a second guard against queueing a
   * firing twice.
   *
   * Every claimed firing gets its own queued row, so firings that happen
   * while the agent is still busy with an earlier one are all delivered.
   *
   * After downtime a timer that missed several occurrences fires once. Missed
   * occurrences are skipped, not counted, and the next firing keeps the
   * original cadence: the first occurrence after now.
   */
  async fireDue(): Promise<string[]> {
    const rows: Array<{ thread_id: string }> = await this.dataSource.query(
      `WITH due AS (
         SELECT tt.id
           FROM thread_timers tt
           JOIN threads t ON t.id = tt.thread_id AND t.deleted_at IS NULL
          WHERE tt.fired_count < tt.max_iterations AND tt.next_fire_at <= now()
          ORDER BY tt.next_fire_at ASC
          LIMIT $1
            FOR UPDATE OF tt SKIP LOCKED
       ),
       fired AS (
         UPDATE thread_timers tt
            SET fired_count = tt.fired_count + 1,
                next_fire_at = CASE
                  WHEN tt.period_seconds IS NULL THEN tt.next_fire_at
                  ELSE tt.next_fire_at + make_interval(secs => tt.period_seconds * (
                    floor(extract(epoch FROM (now() - tt.next_fire_at)) / tt.period_seconds) + 1
                  ))
                END
           FROM due
          WHERE tt.id = due.id
          RETURNING tt.id, tt.thread_id, tt.fired_count
       ),
       queued AS (
         INSERT INTO thread_timer_firings (id, timer_id, thread_id, iteration)
         SELECT gen_random_uuid(), fired.id, fired.thread_id, fired.fired_count FROM fired
         ON CONFLICT ON CONSTRAINT "UQ_thread_timer_firings_iteration" DO NOTHING
         RETURNING thread_id
       )
       SELECT DISTINCT thread_id FROM queued`,
      [FIRE_BATCH_SIZE],
    );
    return rows.map((row) => row.thread_id);
  }

  /** Tells the thread's viewers that its timers changed. */
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
}

function toResult(row: TimerRow): ThreadTimerResult {
  return {
    id: row.id,
    kind: row.kind,
    reason: row.reason,
    periodSeconds: row.period_seconds,
    maxIterations: row.max_iterations,
    firedCount: row.fired_count,
    nextFireAt: new Date(row.next_fire_at),
    createdAt: new Date(row.created_at),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
