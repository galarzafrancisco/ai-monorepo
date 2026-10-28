import { Injectable } from '@nestjs/common';
import { PullRequestsService } from '../../pull-requests/pull-requests.service';
import { PullRequestEntity } from '../../pull-requests/pull-request.entity';
import { PullRequestState } from '../../pull-requests/enums';
import { PullRequestRef, pullRequestUrl } from '../../pull-requests/github/pull-request-ref';
import { ThreadWatchesService, ThreadWatchResult } from './thread-watches.service';
import { ThreadWatchKind } from './thread-watch.enums';
import { describePullRequest, formatPullRequestExpiry } from './pull-request-watch.format';

export const DEFAULT_WATCH_HOURS = 72;
export const MAX_WATCH_HOURS = 24 * 14;

export type WatchPullRequestOutcome =
  | { watching: true; watch: ThreadWatchResult; pullRequest: PullRequestEntity }
  | { watching: false; reason: string; pullRequest: PullRequestEntity };

/**
 * Thread watches on GitHub pull requests: starting and stopping them, with the
 * pull request polled often while watched. PullRequestWatchNotifierService
 * turns pull request changes into notifications.
 */
@Injectable()
export class PullRequestWatchService {
  constructor(
    private readonly pullRequests: PullRequestsService,
    private readonly watches: ThreadWatchesService,
  ) {}

  async watch(input: {
    threadId: string;
    forActorId: string;
    ref: PullRequestRef;
    conditions: string[];
    once: boolean;
    waitingFor: string | null;
    hours: number;
  }): Promise<WatchPullRequestOutcome> {
    // Read now, so the agent answers from the current state and the watch starts from it.
    const [pullRequest] = await this.pullRequests.lookup([input.ref]);
    if (pullRequest.state === PullRequestState.MERGED || pullRequest.state === PullRequestState.CLOSED) {
      return {
        watching: false,
        reason: `It is already ${pullRequest.state === PullRequestState.MERGED ? 'merged' : 'closed'}; there is nothing left to watch.`,
        pullRequest,
      };
    }
    if (!pullRequest.state) {
      return {
        watching: false,
        reason: `Taico could not read it from GitHub: ${pullRequest.lastError ?? 'unknown error'}`,
        pullRequest,
      };
    }

    const expiresAt = new Date(Date.now() + input.hours * 60 * 60 * 1000);
    const watch = await this.watches.watch({
      threadId: input.threadId,
      kind: ThreadWatchKind.PULL_REQUEST,
      targetId: pullRequest.id,
      targetLabel: `${pullRequest.owner}/${pullRequest.repo}#${pullRequest.number}`,
      targetUrl: pullRequestUrl(pullRequest),
      conditions: input.conditions,
      once: input.once,
      waitingFor: input.waitingFor,
      forActorId: input.forActorId,
      expiresAt,
    });
    await this.pullRequests.setWatchedUntil(
      pullRequest.id,
      await this.watches.latestExpiry(ThreadWatchKind.PULL_REQUEST, pullRequest.id),
    );
    return { watching: true, watch, pullRequest };
  }

  /** Keeps the pull request polled often for as long as any watch on it lasts. */
  async syncPolling(pullRequestId: string): Promise<void> {
    await this.pullRequests.setWatchedUntil(
      pullRequestId,
      await this.watches.latestExpiry(ThreadWatchKind.PULL_REQUEST, pullRequestId),
    );
  }

  /** Stops a watch; the pull request goes back to being polled for the watches left, if any. */
  async stop(input: { threadId: string; watchId: string; actorId: string }): Promise<ThreadWatchResult | null> {
    const removed = await this.watches.cancel(input);
    if (removed?.kind === ThreadWatchKind.PULL_REQUEST) {
      await this.pullRequests.setWatchedUntil(
        removed.targetId,
        await this.watches.latestExpiry(ThreadWatchKind.PULL_REQUEST, removed.targetId),
      );
    }
    return removed;
  }

  /** The notification a pull request watch gets when it expires. */
  formatExpiry(watch: ThreadWatchResult): string {
    return formatPullRequestExpiry(watch);
  }

  describe(pullRequest: PullRequestEntity): string {
    return describePullRequest(pullRequest);
  }
}

