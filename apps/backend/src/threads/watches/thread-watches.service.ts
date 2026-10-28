import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { ThreadEntity } from '../thread.entity';
import { ThreadUpdatedEvent } from '../events/threads.events';
import { ThreadWatchEntity } from './thread-watch.entity';
import { ThreadWatchDeliveryEntity } from './thread-watch-delivery.entity';
import { ThreadWatchKind } from './thread-watch.enums';

export type ThreadWatchResult = {
  id: string;
  threadId: string;
  kind: ThreadWatchKind;
  targetId: string;
  targetLabel: string;
  targetUrl: string | null;
  conditions: string[];
  once: boolean;
  waitingFor: string | null;
  /** Who the agent was answering when it started watching. */
  forActorId: string;
  expiresAt: Date;
  createdAt: Date;
};

export type WatchInput = {
  threadId: string;
  kind: ThreadWatchKind;
  targetId: string;
  targetLabel: string;
  targetUrl: string | null;
  conditions: string[];
  once: boolean;
  waitingFor: string | null;
  forActorId: string;
  expiresAt: Date;
};

/** A notification a kind's handler decided a watch should get. */
export type WatchNotification = {
  watch: ThreadWatchResult;
  message: string;
  /** The watch ends with this notification. */
  final: boolean;
};

/**
 * Storage and bookkeeping for every kind of thread watch. Kind handlers find
 * the watches on a target, decide what to say, and hand the notifications
 * here; the agent log delivers them on the next turn
 * (ThreadAgentLogService.ingestWatchDeliveries).
 */
@Injectable()
export class ThreadWatchesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Watching the same target again replaces the conditions, purpose and expiry. */
  async watch(input: WatchInput): Promise<ThreadWatchResult> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `INSERT INTO thread_watches
         (thread_id, kind, target_id, target_label, target_url, conditions, once, waiting_for, subscribed_for_actor_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
       ON CONFLICT (thread_id, kind, target_id) DO UPDATE SET
         target_label = EXCLUDED.target_label,
         target_url = EXCLUDED.target_url,
         conditions = EXCLUDED.conditions,
         once = EXCLUDED.once,
         waiting_for = EXCLUDED.waiting_for,
         subscribed_for_actor_id = EXCLUDED.subscribed_for_actor_id,
         expires_at = EXCLUDED.expires_at
       RETURNING *`,
      [
        input.threadId,
        input.kind,
        input.targetId,
        input.targetLabel,
        input.targetUrl,
        JSON.stringify(input.conditions),
        input.once,
        input.waitingFor?.trim() || null,
        input.forActorId,
        input.expiresAt,
      ],
    );
    await this.emitThreadUpdated(input.threadId, input.forActorId);
    return toResult(rows[0]);
  }

  /** Active watches of a thread, oldest first. */
  async listForThread(threadId: string): Promise<ThreadWatchResult[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT * FROM thread_watches WHERE thread_id = $1 AND expires_at > now() ORDER BY created_at ASC, id ASC`,
      [threadId],
    );
    return rows.map(toResult);
  }

  /** Active watches on a target, across threads. */
  async listForTarget(kind: ThreadWatchKind, targetId: string): Promise<ThreadWatchResult[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT * FROM thread_watches WHERE kind = $1 AND target_id = $2 AND expires_at > now() ORDER BY created_at ASC`,
      [kind, targetId],
    );
    return rows.map(toResult);
  }

  /** The latest expiry of the watches left on a target, or null when none are. */
  async latestExpiry(kind: ThreadWatchKind, targetId: string): Promise<Date | null> {
    const rows: Array<{ until: Date | null }> = await this.dataSource.query(
      `SELECT max(expires_at) AS until FROM thread_watches WHERE kind = $1 AND target_id = $2 AND expires_at > now()`,
      [kind, targetId],
    );
    return rows[0]?.until ? new Date(rows[0].until) : null;
  }

  /** Removes a watch. Returns it, or null when the thread had no such watch. Idempotent. */
  async cancel(input: { threadId: string; watchId: string; actorId: string }): Promise<ThreadWatchResult | null> {
    if (!isUuid(input.watchId)) return null;
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `WITH removed AS (DELETE FROM thread_watches WHERE thread_id = $1 AND id = $2 RETURNING *)
       SELECT * FROM removed`,
      [input.threadId, input.watchId],
    );
    if (rows.length === 0) return null;
    await this.emitThreadUpdated(input.threadId, input.actorId);
    return toResult(rows[0]);
  }

  /**
   * Queues notifications and ends the watches whose notification is final, in
   * one transaction. Returns the threads that now have something to hear.
   */
  async notify(notifications: WatchNotification[]): Promise<string[]> {
    if (notifications.length === 0) return [];
    await this.dataSource.transaction(async (manager) => {
      await this.queue(manager, notifications);
    });
    // Ended watches leave the sidebar.
    const ended = new Map(notifications.filter((n) => n.final).map((n) => [n.watch.threadId, n.watch.forActorId]));
    for (const [threadId, actorId] of ended) {
      await this.emitThreadUpdated(threadId, actorId);
    }
    return [...new Set(notifications.map((n) => n.watch.threadId))];
  }

  /**
   * Ends watches past their expiry with a last notification, so the agent can
   * tell the user it stopped waiting. Claims rows with SKIP LOCKED, so each
   * expiry is told once however many backends sweep.
   */
  async expireDue(format: (watch: ThreadWatchResult) => string, limit = 50): Promise<string[]> {
    return this.dataSource.transaction(async (manager) => {
      const rows: Array<Record<string, unknown>> = await manager.query(
        `SELECT * FROM thread_watches WHERE expires_at <= now() ORDER BY expires_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [limit],
      );
      const notifications = rows.map(toResult).map((watch) => ({ watch, message: format(watch), final: true }));
      await this.queue(manager, notifications);
      return [...new Set(notifications.map((n) => n.watch.threadId))];
    });
  }

  private async queue(manager: EntityManager, notifications: WatchNotification[]): Promise<void> {
    if (notifications.length === 0) return;
    await manager.getRepository(ThreadWatchDeliveryEntity).insert(
      notifications.map((n) => ({
        threadId: n.watch.threadId,
        watchId: n.watch.id,
        kind: n.watch.kind,
        message: n.message,
        forActorId: n.watch.forActorId,
      })),
    );
    const ended = notifications.filter((n) => n.final).map((n) => n.watch.id);
    if (ended.length > 0) {
      await manager.query(`DELETE FROM thread_watches WHERE id = ANY($1::uuid[])`, [ended]);
    }
  }

  async emitThreadUpdated(threadId: string, actorId: string): Promise<void> {
    const thread = await this.dataSource.getRepository(ThreadEntity).findOne({ where: { id: threadId } });
    if (!thread) return;
    this.eventEmitter.emit(ThreadUpdatedEvent.INTERNAL, new ThreadUpdatedEvent({ id: actorId }, thread));
  }
}

function toResult(row: Record<string, unknown>): ThreadWatchResult {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    kind: row.kind as ThreadWatchKind,
    targetId: row.target_id as string,
    targetLabel: row.target_label as string,
    targetUrl: (row.target_url as string | null) ?? null,
    conditions: (row.conditions as string[]) ?? [],
    once: row.once as boolean,
    waitingFor: (row.waiting_for as string | null) ?? null,
    expiresAt: new Date(row.expires_at as string),
    createdAt: new Date(row.created_at as string),
    forActorId: row.subscribed_for_actor_id as string,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
