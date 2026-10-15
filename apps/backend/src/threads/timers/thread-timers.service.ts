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

    const removed: unknown[] = await this.dataSource.query(
      `WITH removed AS (
         DELETE FROM thread_timers WHERE thread_id = $1 AND id = $2 RETURNING id
       )
       SELECT id FROM removed`,
      [input.threadId, input.timerId],
    );
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
   * Claims every due firing and records it for delivery. Returns the threads
   * that now have a firing waiting.
   *
   * Safe to run on many processes at once: a due timer is locked by the first
   * sweep that reaches it and skipped by the others, and claiming it moves
   * `next_fire_at` past now, so it is not due again until its next period.
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
                pending_iteration = tt.fired_count + 1,
                triggered_at = now(),
                next_fire_at = CASE
                  WHEN tt.period_seconds IS NULL THEN tt.next_fire_at
                  ELSE tt.next_fire_at + make_interval(secs => tt.period_seconds * (
                    floor(extract(epoch FROM (now() - tt.next_fire_at)) / tt.period_seconds) + 1
                  ))
                END
           FROM due
          WHERE tt.id = due.id
          RETURNING tt.thread_id
       )
       SELECT DISTINCT thread_id FROM fired`,
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
