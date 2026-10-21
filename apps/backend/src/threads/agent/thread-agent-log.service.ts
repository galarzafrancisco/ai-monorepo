import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { randomUUID } from 'node:crypto';
import { ModelMessage } from 'ai';
import { ActorType } from 'src/identity-provider/enums';
import { ThreadNotFoundError } from '../errors/threads.errors';
import {
  formatMessage,
  formatReminderFiring,
  formatScheduleFiring,
  formatTaskNotification,
  generateThreadSecret,
} from './thread-agent.prompts';
import { ThreadTimerKind } from '../timers/thread-timer.enums';
import { TaskStatus } from '../../tasks/enums';
import { ThreadTokenUsageResult } from '../dto/service/threads.service.types';
import { AgentContextRow } from './agent-context.utils';
import { ThreadAgentMessageEntity } from './thread-agent-message.entity';
import {
  ThreadAgentMessageKind,
  ThreadAgentMessageRole,
} from './thread-agent.enums';

/** `source` of the agent-log rows that carry a task notification. */
export const TASK_NOTIFICATION_SOURCE = 'subscription:task';
/** `source` of the agent-log rows that carry a reminder or schedule firing. */
export const TIMER_FIRING_SOURCE = 'timer';

export type AgentMessageDraft = {
  role: ThreadAgentMessageRole;
  message: ModelMessage;
  source: string;
  kind?: ThreadAgentMessageKind;
  turnId?: string | null;
  providerType?: string | null;
  modelId?: string | null;
  usage?: Record<string, unknown> | null;
  createdAt?: Date;
};

export type TriggerActor = {
  id: string;
  slug: string;
  type: ActorType;
  displayName: string;
};

export type IngestPendingResult = {
  /** Author of the newest unanswered message, or null when the agent has nothing to answer. */
  triggerActor: TriggerActor | null;
  /** Text of the unanswered messages, oldest first. */
  newUserMessages: string[];
};

export type IngestTaskNotificationsResult = {
  /** Who the agent was answering when it subscribed, or null when nothing was waiting. */
  triggerActor: TriggerActor | null;
  /** Tasks the agent has just been told about, oldest change first. */
  notifiedTaskIds: string[];
};

type PendingTaskNotificationRow = {
  task_id: string;
  triggered_status: TaskStatus;
  triggered_task_name: string;
  waiting_for: string | null;
  actor_id: string;
  actor_slug: string;
  actor_type: ActorType;
  actor_display_name: string;
};

export type IngestTimerFiringsResult = {
  /** Who the agent was answering when it set the timer, or null when nothing was waiting. */
  triggerActor: TriggerActor | null;
  /** Timers the agent has just been told about, oldest firing first. */
  firedTimerIds: string[];
};

type PendingTimerFiringRow = {
  firing_id: string;
  id: string;
  kind: ThreadTimerKind;
  reason: string;
  iteration: number;
  max_iterations: number;
  fired_count: number;
  actor_id: string;
  actor_slug: string;
  actor_type: ActorType;
  actor_display_name: string;
};

type PendingDisplayRow = {
  id: string;
  content: string;
  created_at: Date;
  actor_id: string;
  actor_slug: string;
  actor_type: ActorType;
  actor_display_name: string;
};

/**
 * Persistence for the agent-side conversation log. All state lives in Postgres,
 * so any backend process can continue any thread.
 */
@Injectable()
export class ThreadAgentLogService {
  constructor(private readonly dataSource: DataSource) {}

  /** Appends messages after the thread head and moves the head to the last one. */
  async append(
    threadId: string,
    drafts: AgentMessageDraft[],
  ): Promise<ThreadAgentMessageEntity[]> {
    return this.dataSource.transaction((manager) =>
      this.appendWithManager(manager, threadId, drafts),
    );
  }

  /**
   * Copies user-facing messages the agent has not seen yet into the agent log
   * and links each one to its agent-side row.
   *
   * A thread with no agent log yet (created before the log existed) gets its
   * whole visible history imported, with the agent's own messages as assistant turns.
   */
  async ingestPending(input: {
    threadId: string;
    agentActorId: string;
    turnId: string;
  }): Promise<IngestPendingResult> {
    return this.dataSource.transaction(async (manager) => {
      const headId = await this.lockHead(manager, input.threadId);
      const isBackfill = headId === null;

      const unlinked: PendingDisplayRow[] = await manager.query(
        `SELECT tm.id, tm.content, tm.created_at, a.id AS actor_id, a.slug AS actor_slug,
                a.type AS actor_type, a.display_name AS actor_display_name
           FROM thread_messages tm
           JOIN actors a ON a.id = tm.created_by_actor_id
          WHERE tm.thread_id = $1 AND tm.agent_message_id IS NULL
          ORDER BY tm.created_at ASC, tm.id ASC`,
        [input.threadId],
      );

      // Once a log exists, unlinked agent messages are only error notices.
      const pending = isBackfill
        ? unlinked
        : unlinked.filter((row) => row.actor_id !== input.agentActorId);

      if (pending.length === 0) {
        return { triggerActor: null, newUserMessages: [] };
      }

      const drafts = pending.map((row): AgentMessageDraft => {
        const fromAgent = row.actor_id === input.agentActorId;
        return fromAgent
          ? {
              role: ThreadAgentMessageRole.ASSISTANT,
              message: { role: 'assistant', content: row.content },
              source: 'backfill',
              createdAt: row.created_at,
            }
          : {
              role: ThreadAgentMessageRole.USER,
              message: {
                role: 'user',
                content: formatMessage(row.content, {
                  displayName: row.actor_display_name,
                  slug: row.actor_slug,
                }),
              },
              source: 'user',
              turnId: input.turnId,
              createdAt: row.created_at,
            };
      });

      const saved = await this.appendWithManager(manager, input.threadId, drafts);

      for (const [index, row] of pending.entries()) {
        await manager.query(
          `UPDATE thread_messages SET agent_message_id = $1 WHERE id = $2`,
          [saved[index].id, row.id],
        );
      }

      const last = pending[pending.length - 1];
      if (last.actor_id === input.agentActorId) {
        return { triggerActor: null, newUserMessages: [] };
      }

      const lastAgentIndex = pending
        .map((row) => row.actor_id)
        .lastIndexOf(input.agentActorId);

      return {
        triggerActor: {
          id: last.actor_id,
          slug: last.actor_slug,
          type: last.actor_type,
          displayName: last.actor_display_name,
        },
        newUserMessages: pending.slice(lastAgentIndex + 1).map((row) => row.content),
      };
    });
  }

  /** True when someone other than the agent has posted a message the agent has not seen. */
  async hasPending(threadId: string, agentActorId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM thread_messages
        WHERE thread_id = $1 AND agent_message_id IS NULL AND created_by_actor_id <> $2
        LIMIT 1`,
      [threadId, agentActorId],
    );
    return rows.length > 0;
  }

  /**
   * Tells the agent about subscribed tasks that went to review or were done,
   * as messages the user never sees. A done task ends the subscription; a task
   * in review keeps it, so the agent still hears when it is done.
   *
   * One transaction: a notification is delivered exactly once.
   */
  async ingestTaskNotifications(input: {
    threadId: string;
    turnId: string;
  }): Promise<IngestTaskNotificationsResult> {
    return this.dataSource.transaction(async (manager) => {
      // Same lock order as every other writer to the log: the thread first.
      await this.lockHead(manager, input.threadId);

      const pending: PendingTaskNotificationRow[] = await manager.query(
        `SELECT s.task_id, s.triggered_status, s.triggered_task_name, s.waiting_for, a.id AS actor_id,
                a.slug AS actor_slug, a.type AS actor_type, a.display_name AS actor_display_name
           FROM thread_task_subscriptions s
           JOIN actors a ON a.id = s.subscribed_for_actor_id
          WHERE s.thread_id = $1 AND s.triggered_at IS NOT NULL
          ORDER BY s.triggered_at ASC, s.task_id ASC
            FOR UPDATE OF s`,
        [input.threadId],
      );

      if (pending.length === 0) {
        return { triggerActor: null, notifiedTaskIds: [] };
      }

      await this.appendWithManager(
        manager,
        input.threadId,
        pending.map((row): AgentMessageDraft => ({
          role: ThreadAgentMessageRole.USER,
          kind: ThreadAgentMessageKind.INJECTION,
          source: TASK_NOTIFICATION_SOURCE,
          turnId: input.turnId,
          message: {
            role: 'user',
            content: formatTaskNotification({
              id: row.task_id,
              name: row.triggered_task_name,
              status: row.triggered_status,
              waitingFor: row.waiting_for,
            }),
          },
        })),
      );

      // Only the rows read above: one triggered since then waits for the next turn.
      const done = pending
        .filter((row) => row.triggered_status === TaskStatus.DONE)
        .map((row) => row.task_id);
      const stillSubscribed = pending
        .filter((row) => row.triggered_status !== TaskStatus.DONE)
        .map((row) => row.task_id);

      await manager.query(
        `DELETE FROM thread_task_subscriptions
          WHERE thread_id = $1 AND task_id = ANY($2::uuid[])`,
        [input.threadId, done],
      );
      await manager.query(
        `UPDATE thread_task_subscriptions
            SET triggered_status = NULL, triggered_task_name = NULL, triggered_at = NULL
          WHERE thread_id = $1 AND task_id = ANY($2::uuid[])`,
        [input.threadId, stillSubscribed],
      );

      const last = pending[pending.length - 1];
      return {
        triggerActor: {
          id: last.actor_id,
          slug: last.actor_slug,
          type: last.actor_type,
          displayName: last.actor_display_name,
        },
        notifiedTaskIds: pending.map((row) => row.task_id),
      };
    });
  }

  /** True when a subscribed task changed and the agent has not been told yet. */
  async hasPendingTaskNotifications(threadId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM thread_task_subscriptions
        WHERE thread_id = $1 AND triggered_at IS NOT NULL
        LIMIT 1`,
      [threadId],
    );
    return rows.length > 0;
  }

  /**
   * Tells the agent about reminders and schedules that fired, as messages the
   * user never sees: one per queued firing, oldest first. A timer with no
   * firings left is removed once its last firing is delivered.
   *
   * One transaction, with the queued firings locked: a firing is delivered
   * exactly once, however many processes try. Firings queued after the read
   * wait for the next turn.
   */
  async ingestTimerFirings(input: {
    threadId: string;
    turnId: string;
  }): Promise<IngestTimerFiringsResult> {
    return this.dataSource.transaction(async (manager) => {
      // Same lock order as every other writer to the log: the thread first.
      await this.lockHead(manager, input.threadId);

      const pending: PendingTimerFiringRow[] = await manager.query(
        `SELECT f.id AS firing_id, tt.id, tt.kind, tt.reason, f.iteration, tt.max_iterations, tt.fired_count,
                a.id AS actor_id, a.slug AS actor_slug, a.type AS actor_type,
                a.display_name AS actor_display_name
           FROM thread_timer_firings f
           JOIN thread_timers tt ON tt.id = f.timer_id
           JOIN actors a ON a.id = tt.created_for_actor_id
          WHERE f.thread_id = $1
          ORDER BY f.fired_at ASC, f.iteration ASC, f.id ASC
            FOR UPDATE OF f`,
        [input.threadId],
      );

      if (pending.length === 0) {
        return { triggerActor: null, firedTimerIds: [] };
      }

      await this.appendWithManager(
        manager,
        input.threadId,
        pending.map((row): AgentMessageDraft => ({
          role: ThreadAgentMessageRole.USER,
          kind: ThreadAgentMessageKind.INJECTION,
          source: TIMER_FIRING_SOURCE,
          turnId: input.turnId,
          message: {
            role: 'user',
            content:
              row.kind === ThreadTimerKind.REMINDER
                ? formatReminderFiring({ id: row.id, reason: row.reason })
                : formatScheduleFiring({
                    id: row.id,
                    reason: row.reason,
                    iteration: row.iteration,
                    maxIterations: row.max_iterations,
                  }),
          },
        })),
      );

      const timerIds = [...new Set(pending.map((row) => row.id))];

      await manager.query(
        `DELETE FROM thread_timer_firings WHERE id = ANY($1::uuid[])`,
        [pending.map((row) => row.firing_id)],
      );
      // A finished timer cannot queue more firings, so once none are left it is done.
      await manager.query(
        `DELETE FROM thread_timers tt
          WHERE tt.thread_id = $1 AND tt.id = ANY($2::uuid[])
            AND tt.fired_count >= tt.max_iterations
            AND NOT EXISTS (SELECT 1 FROM thread_timer_firings f WHERE f.timer_id = tt.id)`,
        [input.threadId, timerIds],
      );

      const last = pending[pending.length - 1];
      return {
        triggerActor: {
          id: last.actor_id,
          slug: last.actor_slug,
          type: last.actor_type,
          displayName: last.actor_display_name,
        },
        firedTimerIds: timerIds,
      };
    });
  }

  /** True when a reminder or schedule fired and the agent has not been told yet. */
  async hasPendingTimerFirings(threadId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM thread_timer_firings WHERE thread_id = $1 LIMIT 1`,
      [threadId],
    );
    return rows.length > 0;
  }

  /**
   * Loads the active branch, oldest first: from the thread head back to the
   * root, or back to the most recent summary.
   */
  async loadContext(threadId: string): Promise<AgentContextRow[]> {
    const rows: Array<{
      id: string;
      kind: ThreadAgentMessageKind;
      source: string;
      message: unknown;
      format_version: number;
      provider_type: string | null;
      model_id: string | null;
    }> = await this.dataSource.query(
      `WITH RECURSIVE chain AS (
         SELECT m.id, m.parent_id, m.kind, m.source, m.message, m.format_version, m.provider_type, m.model_id, 0 AS depth
           FROM thread_agent_messages m
           JOIN threads t ON t.head_agent_message_id = m.id
          WHERE t.id = $1
         UNION ALL
         SELECT p.id, p.parent_id, p.kind, p.source, p.message, p.format_version, p.provider_type, p.model_id, c.depth + 1
           FROM thread_agent_messages p
           JOIN chain c ON p.id = c.parent_id
          WHERE c.kind <> $2
       )
       SELECT id, kind, source, message, format_version, provider_type, model_id FROM chain ORDER BY depth DESC`,
      [threadId, ThreadAgentMessageKind.SUMMARY],
    );

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      source: row.source,
      message: row.message,
      formatVersion: row.format_version,
      providerType: row.provider_type,
      modelId: row.model_id,
    }));
  }

  /**
   * Token figures for a thread, read from the usage the AI SDK reported for
   * each model step. Steps on branches a compaction left behind still count:
   * the totals are what the thread has spent, not what the model reads now.
   */
  async getTokenUsage(threadId: string): Promise<ThreadTokenUsageResult> {
    // A step with no assistant message, or a provider that reports nothing,
    // leaves no figure: the sums skip those rows.
    const rows: Array<{
      context_tokens: string | null;
      input_tokens: string | null;
      output_tokens: string | null;
      steps: string;
    }> = await this.dataSource.query(
      `SELECT (SELECT l.usage->>'inputTokens'
                 FROM thread_agent_messages l
                WHERE l.thread_id = t.id AND jsonb_typeof(l.usage) = 'object'
                ORDER BY l.created_at DESC, l.id DESC
                LIMIT 1) AS context_tokens,
              SUM((m.usage->>'inputTokens')::numeric) AS input_tokens,
              SUM((m.usage->>'outputTokens')::numeric) AS output_tokens,
              COUNT(m.id) AS steps
         FROM threads t
         LEFT JOIN thread_agent_messages m
           ON m.thread_id = t.id AND jsonb_typeof(m.usage) = 'object'
        WHERE t.id = $1
        GROUP BY t.id`,
      [threadId],
    );

    if (rows.length === 0) {
      throw new ThreadNotFoundError(threadId);
    }

    const toNumber = (value: string | null): number | null =>
      value === null ? null : Number(value);

    return {
      contextTokens: toNumber(rows[0].context_tokens),
      inputTokens: toNumber(rows[0].input_tokens),
      outputTokens: toNumber(rows[0].output_tokens),
      steps: Number(rows[0].steps),
    };
  }

  /**
   * The thread's secret key for Taico-written tags, created the first time the
   * agent runs on the thread. It is only ever sent to the model: never return
   * it from the API or put it in an event.
   */
  async getOrCreateThreadSecret(threadId: string): Promise<string> {
    // One statement, so two processes starting a thread agree on the key.
    // Raw update: it must not bump the thread's row version.
    // TypeORM's Postgres query runner answers a raw UPDATE with
    // [rows, affected count], unlike SELECT and INSERT which answer rows only.
    // thread-agent.e2e-spec.ts runs this against a real database.
    const [rows]: [Array<{ secret: string }>, number] = await this.dataSource.query(
      `UPDATE threads SET secret = COALESCE(secret, $2)
        WHERE id = $1 RETURNING secret`,
      [threadId, generateThreadSecret()],
    );

    if (rows.length === 0) {
      throw new ThreadNotFoundError(threadId);
    }

    return rows[0].secret;
  }

  private async lockHead(
    manager: EntityManager,
    threadId: string,
  ): Promise<string | null> {
    const rows: Array<{ head_agent_message_id: string | null }> =
      await manager.query(
        `SELECT head_agent_message_id FROM threads WHERE id = $1 FOR UPDATE`,
        [threadId],
      );

    if (rows.length === 0) {
      throw new ThreadNotFoundError(threadId);
    }

    return rows[0].head_agent_message_id;
  }

  private async appendWithManager(
    manager: EntityManager,
    threadId: string,
    drafts: AgentMessageDraft[],
  ): Promise<ThreadAgentMessageEntity[]> {
    let parentId = await this.lockHead(manager, threadId);

    const rows = drafts.map((draft) => {
      const row = manager.create(ThreadAgentMessageEntity, {
        id: randomUUID(),
        threadId,
        parentId,
        role: draft.role,
        kind: draft.kind ?? ThreadAgentMessageKind.MESSAGE,
        source: draft.source,
        message: draft.message as unknown as Record<string, unknown>,
        turnId: draft.turnId ?? null,
        providerType: draft.providerType ?? null,
        modelId: draft.modelId ?? null,
        usage: draft.usage ?? null,
        ...(draft.createdAt ? { createdAt: draft.createdAt } : {}),
      });
      parentId = row.id;
      return row;
    });

    if (rows.length === 0) {
      return rows;
    }

    await manager.insert(
      ThreadAgentMessageEntity,
      rows as QueryDeepPartialEntity<ThreadAgentMessageEntity>[],
    );
    // Raw update: moving the head must not bump the thread's row version.
    await manager.query(
      `UPDATE threads SET head_agent_message_id = $1 WHERE id = $2`,
      [parentId, threadId],
    );

    return rows;
  }
}
