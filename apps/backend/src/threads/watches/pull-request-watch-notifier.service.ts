import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PullRequestUpdatedEvent } from '../../pull-requests/events/pull-requests.events';
import { ThreadAgentService } from '../agent/thread-agent.service';
import { ThreadWatchesService } from './thread-watches.service';
import { ThreadWatchKind } from './thread-watch.enums';
import { isFinishing, relevantChanges } from './pull-request-watch.conditions';
import { formatPullRequestNotification } from './pull-request-watch.format';
import { PullRequestWatchService } from './pull-request-watch.service';

/** Wakes the threads agent when a pull request one of its threads watches changes the way it waits for. */
@Injectable()
export class PullRequestWatchNotifierService {
  private readonly logger = new Logger(PullRequestWatchNotifierService.name);

  constructor(
    private readonly watches: ThreadWatchesService,
    private readonly pullRequestWatches: PullRequestWatchService,
    private readonly threadAgentService: ThreadAgentService,
  ) {}

  @OnEvent(PullRequestUpdatedEvent.INTERNAL)
  async onPullRequestUpdated(event: PullRequestUpdatedEvent): Promise<void> {
    if (event.changes.length === 0) return;
    try {
      const watches = await this.watches.listForTarget(ThreadWatchKind.PULL_REQUEST, event.pullRequest.id);
      const notifications = watches.flatMap((watch) => {
        const changes = relevantChanges(watch.conditions, event.changes);
        if (changes.length === 0) return [];
        const final = watch.once || isFinishing(changes);
        return [
          {
            watch,
            final,
            message: formatPullRequestNotification({ watch, pullRequest: event.pullRequest, changes, final }),
          },
        ];
      });
      const threadIds = await this.watches.notify(notifications);
      for (const threadId of threadIds) this.threadAgentService.requestTurn(threadId);
      if (notifications.some((n) => n.final)) {
        await this.pullRequestWatches.syncPolling(event.pullRequest.id);
      }
    } catch (error) {
      this.logger.warn({
        message: 'Failed to notify threads watching a pull request',
        pullRequest: event.pullRequest.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

}
