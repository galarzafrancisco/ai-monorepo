import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { GithubConnectionsService } from '../integrations/github-connections.service';
import { GithubRequestFailedError, IntegrationsDomainError } from '../integrations/errors/integrations.errors';
import { PullRequestEntity } from './pull-request.entity';
import { PullRequestReferenceEntity } from './pull-request-reference.entity';
import { PullRequestReferenceSource } from './enums';
import { PullRequestUpdatedEvent } from './events/pull-requests.events';
import { PullRequestNotFoundError } from './errors/pull-requests.errors';
import { PullRequestRef, pullRequestKey } from './github/pull-request-ref';
import { fetchPullRequest } from './github/pull-request-fetcher';
import { diffPullRequest } from './github/pull-request-changes';
import {
  FETCH_LEASE_MS,
  nextFetchDelayMs,
  retryDelayMs,
  VIEW_STALE_MS,
} from './pull-request-schedule';
import { PullRequestReferenceInput } from './dto/service/pull-requests.service.types';

/** Pull requests looked at together when a page asks for ones Taico has never read. */
const FIRST_FETCH_CONCURRENCY = 6;

/**
 * Keeps one up-to-date copy of each linked GitHub pull request. Reads are
 * served from the stored copy; GitHub is asked again on a schedule that follows
 * demand (see pull-request-schedule.ts), when a webhook says something changed,
 * or the first time a pull request is seen.
 */
@Injectable()
export class PullRequestsService {
  private readonly logger = new Logger(PullRequestsService.name);

  constructor(
    @InjectRepository(PullRequestEntity)
    private readonly pullRequests: Repository<PullRequestEntity>,
    @InjectRepository(PullRequestReferenceEntity)
    private readonly references: Repository<PullRequestReferenceEntity>,
    private readonly connections: GithubConnectionsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * The stored state of each pull request, in the order asked, for someone
   * looking at them. Pull requests Taico has never read are read now; stale
   * ones are queued for a fresh look and arrive over the socket.
   */
  async lookup(refs: PullRequestRef[]): Promise<PullRequestEntity[]> {
    const rows = await this.ensureRows(refs);
    const now = new Date();

    const neverFetched = rows.filter((row) => !row.lastFetchedAt);
    await runWithConcurrency(neverFetched, FIRST_FETCH_CONCURRENCY, (row) => this.fetchAndStore(row));

    const stale = rows
      .filter((row) => row.lastFetchedAt && now.getTime() - row.lastFetchedAt.getTime() > VIEW_STALE_MS)
      .map((row) => row.id);
    await this.pullRequests.update({ id: In(rows.map((row) => row.id)) }, { lastViewedAt: now });
    if (stale.length > 0) {
      await this.dataSource.query(
        `UPDATE pull_requests SET next_fetch_at = now()
          WHERE id = ANY($1::uuid[]) AND (next_fetch_at IS NULL OR next_fetch_at > now())`,
        [stale],
      );
    }

    const byId = new Map((await this.pullRequests.findBy({ id: In(rows.map((row) => row.id)) })).map((row) => [row.id, row]));
    return rows.map((row) => byId.get(row.id)!);
  }

  async getById(id: string): Promise<PullRequestEntity> {
    const row = await this.pullRequests.findOne({ where: { id } });
    if (!row) throw new PullRequestNotFoundError(id);
    return row;
  }

  /** Reads the pull request from GitHub now. */
  async refresh(id: string): Promise<PullRequestEntity> {
    return this.fetchAndStore(await this.getById(id));
  }

  /** Pull requests linked from a task (its links, description and comments), oldest link first. */
  async listForTasks(taskIds: string[]): Promise<PullRequestEntity[]> {
    if (taskIds.length === 0) return [];
    const ids: Array<{ pull_request_id: string }> = await this.dataSource.query(
      `SELECT pull_request_id FROM pull_request_references
        WHERE task_id = ANY($1::uuid[])
        GROUP BY pull_request_id
        ORDER BY min(created_at) ASC`,
      [taskIds],
    );
    return this.inOrder(ids.map((row) => row.pull_request_id));
  }

  /**
   * Pull requests attached as links (artefacts) to these tasks, oldest link
   * first. Mentions in descriptions and comments are left out.
   */
  async listLinkedToTasks(taskIds: string[]): Promise<PullRequestEntity[]> {
    const ids: Array<{ pull_request_id: string }> = await this.dataSource.query(
      `SELECT pull_request_id FROM pull_request_references
        WHERE source_type = $1 AND task_id = ANY($2::uuid[])
        GROUP BY pull_request_id
        ORDER BY min(created_at) ASC`,
      [PullRequestReferenceSource.TASK_ARTEFACT, taskIds],
    );
    return this.inOrder(ids.map((row) => row.pull_request_id));
  }

  /**
   * Records where links to pull requests appear. The links a source holds now
   * replace the ones it held before, so an edited description drops the pull
   * requests it no longer mentions. New pull requests are read soon.
   */
  async replaceReferences(input: PullRequestReferenceInput): Promise<void> {
    const rows = await this.ensureRows(input.refs);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(PullRequestReferenceEntity, {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      });
      if (rows.length === 0) return;
      await manager
        .createQueryBuilder()
        .insert()
        .into(PullRequestReferenceEntity)
        .values(
          rows.map((row) => ({
            pullRequestId: row.id,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            taskId: input.taskId ?? null,
            threadId: input.threadId ?? null,
          })),
        )
        .orIgnore()
        .execute();
    });
  }

  /** Forgets every link held by a source (a deleted task, comment or message). */
  async removeReferences(sourceType: PullRequestReferenceSource, sourceId: string): Promise<void> {
    await this.references.delete({ sourceType, sourceId });
  }

  /**
   * Asks for a fresh look at pull requests of a repository that Taico already
   * knows: by number, or by the commit at their head (CI events only name the
   * commit). Called when a webhook arrives.
   */
  async markChanged(input: { owner: string; repo: string; numbers?: number[]; headSha?: string | null }): Promise<number> {
    const keys = (input.numbers ?? []).map((number) => pullRequestKey({ owner: input.owner, repo: input.repo, number }));
    const result: [unknown[], number] = await this.dataSource.query(
      `UPDATE pull_requests SET next_fetch_at = now()
        WHERE (key = ANY($1::text[])
               OR ($2::text IS NOT NULL AND lower(owner) = lower($3) AND lower(repo) = lower($4) AND head_sha = $2))
          AND (next_fetch_at IS NULL OR next_fetch_at > now())`,
      [keys, input.headSha ?? null, input.owner, input.repo],
    );
    return result[1];
  }

  /**
   * Until when something waits on the pull request (null: nothing does). While
   * watched it is polled often, starting now.
   */
  async setWatchedUntil(id: string, until: Date | null): Promise<void> {
    await this.dataSource.query(
      `UPDATE pull_requests
          SET watched_until = $2,
              next_fetch_at = CASE
                WHEN $2::timestamptz IS NOT NULL AND state = 'open' THEN LEAST(COALESCE(next_fetch_at, now()), now())
                ELSE next_fetch_at
              END
        WHERE id = $1`,
      [id, until],
    );
  }

  /**
   * Claims pull requests that are due for a look, so no other backend process
   * takes them for FETCH_LEASE_MS, and looks at each.
   */
  async fetchDue(limit: number): Promise<number> {
    // Selected from a CTE: a bare UPDATE ... RETURNING comes back as [rows, count].
    const claimed: Array<{ id: string }> = await this.dataSource.query(
      `WITH claimed AS (
         UPDATE pull_requests p
            SET next_fetch_at = now() + ($2 || ' milliseconds')::interval
           FROM (SELECT id FROM pull_requests
                  WHERE next_fetch_at <= now()
                  ORDER BY next_fetch_at ASC
                  LIMIT $1
                  FOR UPDATE SKIP LOCKED) due
          WHERE p.id = due.id
          RETURNING p.id
       )
       SELECT id FROM claimed`,
      [limit, String(FETCH_LEASE_MS)],
    );
    if (claimed.length === 0) return 0;
    const rows = await this.pullRequests.findBy({ id: In(claimed.map((row) => row.id)) });
    await runWithConcurrency(rows, FIRST_FETCH_CONCURRENCY, (row) => this.fetchAndStore(row));
    return rows.length;
  }

  /**
   * Reads one pull request from GitHub, stores what changed, and decides when
   * to look again. Never throws for GitHub failures: they are stored on the row
   * and retried with backoff.
   */
  private async fetchAndStore(row: PullRequestEntity): Promise<PullRequestEntity> {
    const ref = { owner: row.owner, repo: row.repo, number: row.number };
    let webhooksActive = false;
    try {
      webhooksActive = await this.connections.hasActiveWebhook(row.owner, row.repo);
      const resolved = await this.connections.resolveForRepositoryOfAnyProject(ref);
      const token = resolved ? (await this.connections.getAccessToken(resolved.connection.id)).token : null;

      const before = row.lastFetchedAt ? { ...row } : null;
      const fetched = await fetchPullRequest(token, ref, row.etags, before);
      const snapshot = fetched.snapshot;
      const changes = diffPullRequest(
        before && before.state && before.headSha
          ? {
              state: before.state,
              draft: before.draft,
              headSha: before.headSha,
              checksStatus: before.checksStatus,
              reviewDecision: before.reviewDecision,
              approvals: before.approvals,
              commentCount: before.commentCount ?? 0,
            }
          : null,
        snapshot,
      );

      Object.assign(row, snapshot, {
        etags: fetched.etags,
        lastFetchedAt: new Date(),
        lastError: null,
        failedFetches: 0,
      });
      row.nextFetchAt = await this.nextFetchAt(row, webhooksActive);
      const saved = await this.pullRequests.save(row);
      if (!before || changes.length > 0 || hasDisplayChanges(before, saved)) {
        this.eventEmitter.emit(PullRequestUpdatedEvent.INTERNAL, new PullRequestUpdatedEvent(saved, changes));
      }
      return saved;
    } catch (error) {
      if (!(error instanceof IntegrationsDomainError)) {
        this.logger.warn({
          message: 'Failed to read a pull request',
          pullRequest: row.key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return this.storeFailure(row, error, webhooksActive);
    }
  }

  private async storeFailure(row: PullRequestEntity, error: unknown, webhooksActive: boolean): Promise<PullRequestEntity> {
    const status = error instanceof GithubRequestFailedError ? error.status : null;
    row.failedFetches += 1;
    row.lastError =
      status === 404
        ? 'GitHub says this pull request does not exist, or the connection cannot see its repository.'
        : status === 401
          ? 'GitHub rejected the connection used for this repository.'
          : error instanceof Error
            ? error.message
            : String(error);
    const demand = await this.nextFetchAt(row, webhooksActive);
    // A missing pull request is only tried again when something asks for it.
    row.nextFetchAt =
      status === 404 && !row.watchedUntil
        ? null
        : demand || !row.lastFetchedAt
          ? new Date(Date.now() + retryDelayMs(row.failedFetches))
          : null;
    const saved = await this.pullRequests.save(row);
    this.eventEmitter.emit(PullRequestUpdatedEvent.INTERNAL, new PullRequestUpdatedEvent(saved, []));
    return saved;
  }

  private async nextFetchAt(row: PullRequestEntity, webhooksActive: boolean): Promise<Date | null> {
    const now = new Date();
    const delay = nextFetchDelayMs({
      state: row.state,
      now,
      watchedUntil: row.watchedUntil,
      lastViewedAt: row.lastViewedAt,
      isReferencedByActiveWork: await this.isReferencedByActiveWork(row.id),
      webhooksActive,
    });
    return delay === null ? null : new Date(now.getTime() + delay);
  }

  /** Linked from a task that is not done, or from a thread in the last day. */
  private async isReferencedByActiveWork(pullRequestId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM pull_request_references r
         LEFT JOIN tasks t ON t.id = r.task_id AND t.deleted_at IS NULL
        WHERE r.pull_request_id = $1
          AND ((r.task_id IS NOT NULL AND t.status <> 'DONE')
               OR (r.thread_id IS NOT NULL AND r.created_at > now() - interval '1 day'))
        LIMIT 1`,
      [pullRequestId],
    );
    return rows.length > 0;
  }

  /** Finds or creates the rows for these pull requests, without duplicates, in the order given. */
  private async ensureRows(refs: PullRequestRef[]): Promise<PullRequestEntity[]> {
    const unique = new Map<string, PullRequestRef>();
    for (const ref of refs) unique.set(pullRequestKey(ref), ref);
    if (unique.size === 0) return [];

    await this.pullRequests
      .createQueryBuilder()
      .insert()
      .into(PullRequestEntity)
      .values(
        [...unique.entries()].map(([key, ref]) => ({
          key,
          owner: ref.owner,
          repo: ref.repo,
          number: ref.number,
          // Read soon, so the first person to see the link sees its state.
          nextFetchAt: new Date(),
        })),
      )
      .orIgnore()
      .execute();

    const rows = await this.pullRequests.findBy({ key: In([...unique.keys()]) });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return [...unique.keys()].map((key) => byKey.get(key)!);
  }

  private async inOrder(ids: string[]): Promise<PullRequestEntity[]> {
    if (ids.length === 0) return [];
    const byId = new Map((await this.pullRequests.findBy({ id: In(ids) })).map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id)).filter((row): row is PullRequestEntity => !!row);
  }
}

/** Whether something shown on screen changed, even if no one should be told. */
function hasDisplayChanges(before: PullRequestEntity, after: PullRequestEntity): boolean {
  const fields: Array<keyof PullRequestEntity> = [
    'title',
    'state',
    'draft',
    'additions',
    'deletions',
    'changedFiles',
    'commentCount',
    'checksStatus',
    'checksTotal',
    'checksPassed',
    'checksFailed',
    'checksPending',
    'reviewDecision',
    'approvals',
    'lastError',
  ];
  return fields.some((field) => before[field] !== after[field]);
}

async function runWithConcurrency<T>(items: T[], limit: number, work: (item: T) => Promise<unknown>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await work(item);
    }
  });
  await Promise.all(workers);
}
