import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { GithubConnectionsService } from '../integrations/github-connections.service';
import {
  GithubConnectionInvalidError,
  GithubRequestFailedError,
  IntegrationsDomainError,
} from '../integrations/errors/integrations.errors';
import { GITHUB_COM_URL, githubApiUrlFor, isGithubCom } from '../integrations/github/github-host';
import { IssueEntity } from './issue.entity';
import { IssueReferenceEntity } from './issue-reference.entity';
import { IssueReferenceSource } from './enums';
import { IssueUpdatedEvent } from './events/issues.events';
import { IssueNotFoundError } from './errors/issues.errors';
import { extractIssueRefs, IssueRef, issueHost, issueKey, parseIssueRef } from './github/issue-ref';
import { fetchIssue } from './github/issue-fetcher';
import { diffIssue } from './github/issue-changes';
import { FETCH_LEASE_MS, nextIssueFetchDelayMs, retryDelayMs, VIEW_STALE_MS } from './issue-schedule';
import { IssueReferenceInput } from './dto/service/issues.service.types';
import { workspaceOfSource } from '../workspaces/source-workspace';

/** Issues looked at together when a page asks for ones Taico has never read. */
const FIRST_FETCH_CONCURRENCY = 6;

/**
 * Keeps one up-to-date copy of each linked GitHub issue per workspace, read
 * with that workspace's connections. Reads are served from
 * the stored copy; GitHub is asked again on a schedule that follows demand
 * (see issue-schedule.ts), when a webhook says something changed, or the first
 * time an issue is seen.
 */
@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    @InjectRepository(IssueEntity)
    private readonly issues: Repository<IssueEntity>,
    @InjectRepository(IssueReferenceEntity)
    private readonly references: Repository<IssueReferenceEntity>,
    private readonly connections: GithubConnectionsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * The stored state of each issue, in the order asked, for someone looking
   * at them. Issues Taico has never read are read now; stale ones are queued
   * for a fresh look and arrive over the socket.
   */
  async lookup(workspaceId: string, refs: IssueRef[]): Promise<IssueEntity[]> {
    const rows = await this.ensureRows(workspaceId, refs);
    const now = new Date();

    const neverFetched = rows.filter((row) => !row.lastFetchedAt);
    await runWithConcurrency(neverFetched, FIRST_FETCH_CONCURRENCY, (row) => this.fetchAndStore(row));

    const stale = rows
      .filter((row) => row.lastFetchedAt && now.getTime() - row.lastFetchedAt.getTime() > VIEW_STALE_MS)
      .map((row) => row.id);
    if (rows.length > 0) {
      await this.issues.update({ workspaceId, id: In(rows.map((row) => row.id)) }, { lastViewedAt: now });
    }
    if (stale.length > 0) {
      await this.dataSource.query(
        `UPDATE issues SET next_fetch_at = now()
          WHERE workspace_id = $2 AND id = ANY($1::uuid[]) AND (next_fetch_at IS NULL OR next_fetch_at > now())`,
        [stale, workspaceId],
      );
    }

    const byId = new Map(
      (await this.issues.findBy({ workspaceId, id: In(rows.map((row) => row.id)) })).map((row) => [row.id, row]),
    );
    return rows.map((row) => byId.get(row.id)!);
  }

  /** Issue links in a text, on github.com and the GitHub Enterprises the workspace has connections to. */
  async extractRefs(workspaceId: string, text: string | null | undefined): Promise<IssueRef[]> {
    if (!text) return [];
    return extractIssueRefs(text, await this.connections.listEnterpriseHosts(workspaceId));
  }

  /** A link or short reference (`owner/repo#12`, `github.acme.com/owner/repo#12`); null if it is not one. */
  async parseRef(workspaceId: string, value: string): Promise<IssueRef | null> {
    return parseIssueRef(value, await this.listEnterpriseHosts(workspaceId));
  }

  /** Hosts of the GitHub Enterprises the workspace has connections to. */
  listEnterpriseHosts(workspaceId: string): Promise<string[]> {
    return this.connections.listEnterpriseHosts(workspaceId);
  }

  /** An issue of another workspace is not found. */
  async getById(workspaceId: string, id: string): Promise<IssueEntity> {
    const row = await this.issues.findOne({ where: { workspaceId, id } });
    if (!row) throw new IssueNotFoundError(id);
    return row;
  }

  /** Reads the issue from GitHub now. */
  async refresh(workspaceId: string, id: string): Promise<IssueEntity> {
    return this.fetchAndStore(await this.getById(workspaceId, id));
  }

  /**
   * Issues attached as links (artefacts) to these tasks, oldest link first.
   * Mentions in descriptions and comments are left out.
   */
  async listLinkedToTasks(workspaceId: string, taskIds: string[]): Promise<IssueEntity[]> {
    if (taskIds.length === 0) return [];
    const ids: Array<{ issue_id: string }> = await this.dataSource.query(
      `SELECT issue_id FROM issue_references
        WHERE workspace_id = $3 AND source_type = $1 AND task_id = ANY($2::uuid[])
        GROUP BY issue_id
        ORDER BY min(created_at) ASC`,
      [IssueReferenceSource.TASK_ARTEFACT, taskIds, workspaceId],
    );
    return this.inOrder(workspaceId, ids.map((row) => row.issue_id));
  }

  /**
   * Records where links to issues appear. The links a source holds now replace
   * the ones it held before, so an edited description drops the issues it no
   * longer mentions. New issues are read soon.
   *
   * The link is recorded in the workspace of the task or thread it was
   * written in, against that workspace's copy of the issue, so it is read
   * with that workspace's connections only. A source that is gone records
   * nothing.
   */
  async replaceReferences(input: IssueReferenceInput): Promise<void> {
    const workspaceId = await workspaceOfSource(this.dataSource, input);
    const rows = workspaceId ? await this.ensureRows(workspaceId, input.refs) : [];
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(IssueReferenceEntity, {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      });
      if (rows.length === 0) return;
      await manager
        .createQueryBuilder()
        .insert()
        .into(IssueReferenceEntity)
        .values(
          rows.map((row) => ({
            workspaceId: row.workspaceId,
            issueId: row.id,
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

  /**
   * Asks for a fresh look at issues of a repository that Taico already knows.
   * Called when a webhook arrives, for the workspace of the connection it
   * came through.
   */
  async markChanged(
    workspaceId: string,
    input: { host: string; owner: string; repo: string; numbers: number[] },
  ): Promise<number> {
    const keys = input.numbers.map((number) =>
      issueKey({ host: input.host, owner: input.owner, repo: input.repo, number }),
    );
    if (keys.length === 0) return 0;
    const result: [unknown[], number] = await this.dataSource.query(
      `UPDATE issues SET next_fetch_at = now()
        WHERE workspace_id = $2 AND key = ANY($1::text[])
          AND (next_fetch_at IS NULL OR next_fetch_at > now())`,
      [keys, workspaceId],
    );
    return result[1];
  }

  /**
   * Claims issues that are due for a look, so no other backend process takes
   * them for FETCH_LEASE_MS, and looks at each.
   */
  async fetchDue(limit: number): Promise<number> {
    // Selected from a CTE: a bare UPDATE ... RETURNING comes back as [rows, count].
    const claimed: Array<{ id: string }> = await this.dataSource.query(
      `WITH claimed AS (
         UPDATE issues i
            SET next_fetch_at = now() + ($2 || ' milliseconds')::interval
           FROM (SELECT id FROM issues
                  WHERE next_fetch_at <= now()
                  ORDER BY next_fetch_at ASC
                  LIMIT $1
                  FOR UPDATE SKIP LOCKED) due
          WHERE i.id = due.id
          RETURNING i.id
       )
       SELECT id FROM claimed`,
      [limit, String(FETCH_LEASE_MS)],
    );
    if (claimed.length === 0) return 0;
    const rows = await this.issues.findBy({ id: In(claimed.map((row) => row.id)) });
    await runWithConcurrency(rows, FIRST_FETCH_CONCURRENCY, (row) => this.fetchAndStore(row));
    return rows.length;
  }

  /**
   * Reads one issue from GitHub, stores what changed, and decides when to look
   * again. Never throws for GitHub failures: they are stored on the row and
   * retried with backoff.
   */
  private async fetchAndStore(row: IssueEntity): Promise<IssueEntity> {
    const ref = { host: row.host, owner: row.owner, repo: row.repo, number: row.number };
    let webhooksActive = false;
    try {
      // Only the issue's own workspace's connections read it.
      webhooksActive = await this.connections.hasActiveWebhook(row.workspaceId, ref);
      const resolved = await this.connections.resolveForRepositoryOfAnyProject(row.workspaceId, ref);
      if (!resolved && !isGithubCom(row.host)) {
        throw new GithubConnectionInvalidError(`No GitHub connection is set up for ${row.host}.`);
      }
      const api = {
        apiUrl: githubApiUrlFor(resolved?.connection.baseUrl ?? GITHUB_COM_URL),
        credential: resolved
          ? (await this.connections.getAccessToken(row.workspaceId, resolved.connection.id)).token
          : null,
      };

      const before = row.lastFetchedAt && row.state ? { ...row } : null;
      const fetched = await fetchIssue(api, ref, row.etags, before !== null);
      const snapshot = fetched.snapshot;
      const changes = snapshot
        ? diffIssue(
            before
              ? { state: before.state!, assignees: before.assignees, labels: before.labels, commentCount: before.commentCount ?? 0 }
              : null,
            snapshot,
          )
        : [];

      Object.assign(row, snapshot ?? {}, {
        etags: fetched.etags,
        lastFetchedAt: new Date(),
        lastError: null,
        failedFetches: 0,
      });
      row.nextFetchAt = await this.nextFetchAt(row, webhooksActive);
      const saved = await this.issues.save(row);
      if (!before || changes.length > 0 || hasDisplayChanges(before, saved)) {
        this.eventEmitter.emit(IssueUpdatedEvent.INTERNAL, new IssueUpdatedEvent(saved, changes));
      }
      return saved;
    } catch (error) {
      if (!(error instanceof IntegrationsDomainError)) {
        this.logger.warn({
          message: 'Failed to read an issue',
          issue: row.key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return this.storeFailure(row, error, webhooksActive);
    }
  }

  private async storeFailure(row: IssueEntity, error: unknown, webhooksActive: boolean): Promise<IssueEntity> {
    const status = error instanceof GithubRequestFailedError ? error.status : null;
    row.failedFetches += 1;
    row.lastError =
      status === 404 || status === 410
        ? 'GitHub says this issue does not exist, or the connection cannot see its repository.'
        : status === 401
          ? 'GitHub rejected the connection used for this repository.'
          : error instanceof Error
            ? error.message
            : String(error);
    const demand = await this.nextFetchAt(row, webhooksActive);
    // A missing issue is only tried again when something asks for it.
    row.nextFetchAt =
      status === 404 || status === 410
        ? null
        : demand || !row.lastFetchedAt
          ? new Date(Date.now() + retryDelayMs(row.failedFetches))
          : null;
    const saved = await this.issues.save(row);
    this.eventEmitter.emit(IssueUpdatedEvent.INTERNAL, new IssueUpdatedEvent(saved, []));
    return saved;
  }

  private async nextFetchAt(row: IssueEntity, webhooksActive: boolean): Promise<Date | null> {
    const now = new Date();
    const delay = nextIssueFetchDelayMs({
      state: row.state,
      now,
      lastViewedAt: row.lastViewedAt,
      isReferencedByActiveWork: await this.isReferencedByActiveWork(row.workspaceId, row.id),
      webhooksActive,
    });
    return delay === null ? null : new Date(now.getTime() + delay);
  }

  /** Linked from a task that is not done, or from a thread in the last day. */
  private async isReferencedByActiveWork(workspaceId: string, issueId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM issue_references r
         LEFT JOIN tasks t ON t.id = r.task_id AND t.deleted_at IS NULL AND t.workspace_id = r.workspace_id
        WHERE r.workspace_id = $2 AND r.issue_id = $1
          AND ((r.task_id IS NOT NULL AND t.status <> 'DONE')
               OR (r.thread_id IS NOT NULL AND r.created_at > now() - interval '1 day'))
        LIMIT 1`,
      [issueId, workspaceId],
    );
    return rows.length > 0;
  }

  /** Finds or creates the workspace's rows for these issues, without duplicates, in the order given. */
  private async ensureRows(workspaceId: string, refs: IssueRef[]): Promise<IssueEntity[]> {
    const unique = new Map<string, IssueRef>();
    for (const ref of refs) unique.set(issueKey(ref), ref);
    if (unique.size === 0) return [];

    await this.issues
      .createQueryBuilder()
      .insert()
      .into(IssueEntity)
      .values(
        [...unique.entries()].map(([key, ref]) => ({
          workspaceId,
          key,
          host: issueHost(ref),
          owner: ref.owner,
          repo: ref.repo,
          number: ref.number,
          // Read soon, so the first person to see the link sees its state.
          nextFetchAt: new Date(),
        })),
      )
      .orIgnore()
      .execute();

    const rows = await this.issues.findBy({ workspaceId, key: In([...unique.keys()]) });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return [...unique.keys()].map((key) => byKey.get(key)!);
  }

  private async inOrder(workspaceId: string, ids: string[]): Promise<IssueEntity[]> {
    if (ids.length === 0) return [];
    const byId = new Map((await this.issues.findBy({ workspaceId, id: In(ids) })).map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id)).filter((row): row is IssueEntity => !!row);
  }
}

/** Whether something shown on screen changed, even if no one should be told. */
function hasDisplayChanges(before: IssueEntity, after: IssueEntity): boolean {
  const fields: Array<keyof IssueEntity> = [
    'title',
    'state',
    'stateReason',
    'isPullRequest',
    'milestone',
    'commentCount',
    'lastError',
  ];
  return (
    fields.some((field) => before[field] !== after[field]) ||
    JSON.stringify(before.labels) !== JSON.stringify(after.labels) ||
    JSON.stringify(before.assignees) !== JSON.stringify(after.assignees)
  );
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
