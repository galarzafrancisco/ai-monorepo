import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ThreadTurnStatus } from './thread-agent.enums';

const HEARTBEAT_INTERVAL_MS = 10_000;
const STALE_AFTER_SECONDS = 60;

export type ClaimedTurn = {
  id: string;
  threadId: string;
};

/**
 * Cross-process lock: at most one running agent turn per thread, enforced by a
 * partial unique index. A turn whose owner died stops heartbeating and is
 * failed by the next claim attempt.
 */
@Injectable()
export class ThreadTurnsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Returns the claimed turn, or null when another turn is running on the thread. */
  async tryClaim(threadId: string): Promise<ClaimedTurn | null> {
    await this.dataSource.query(
      `UPDATE thread_turns
          SET status = $2, error = 'Turn stopped heartbeating', finished_at = now()
        WHERE thread_id = $1 AND status = $3
          AND heartbeat_at < now() - make_interval(secs => $4)`,
      [threadId, ThreadTurnStatus.FAILED, ThreadTurnStatus.RUNNING, STALE_AFTER_SECONDS],
    );

    const id = randomUUID();
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO thread_turns (id, thread_id, status) VALUES ($1, $2, $3)
       ON CONFLICT (thread_id) WHERE status = 'running'
         DO UPDATE SET request_count = thread_turns.request_count + 1
       RETURNING id`,
      [id, threadId, ThreadTurnStatus.RUNNING],
    );

    return rows[0].id === id ? { id, threadId } : null;
  }

  /** Keeps the claim alive while the turn runs. Returns a function that stops it. */
  startHeartbeat(turnId: string): () => void {
    const timer = setInterval(() => {
      void this.dataSource
        .query(`UPDATE thread_turns SET heartbeat_at = now() WHERE id = $1`, [turnId])
        .catch(() => undefined);
    }, HEARTBEAT_INTERVAL_MS);
    timer.unref();

    return () => clearInterval(timer);
  }

  async finish(
    turnId: string,
    status: ThreadTurnStatus.COMPLETED | ThreadTurnStatus.FAILED,
    error?: string,
  ): Promise<number> {
    const [rows]: [Array<{ request_count: string }>, number] = await this.dataSource.query(
      `UPDATE thread_turns SET status = $2, error = $3, finished_at = now()
        WHERE id = $1 AND status = $4 RETURNING request_count`,
      [turnId, status, error ?? null, ThreadTurnStatus.RUNNING],
    );
    return Number(rows[0]?.request_count ?? 0);
  }
}
