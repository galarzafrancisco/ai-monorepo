import { PullRequestEntity } from '../pull-request.entity';
import { PullRequestChange } from '../enums';

/**
 * A pull request's stored state changed after a look at GitHub. `changes` is
 * empty for the first look (nothing to compare with) and for changes that
 * matter only for display, such as a new title or size.
 */
export class PullRequestUpdatedEvent {
  static readonly INTERNAL = Symbol('pullRequests.PullRequestUpdatedEvent');

  readonly occurredAt: Date = new Date();

  constructor(
    public readonly pullRequest: PullRequestEntity,
    public readonly changes: PullRequestChange[],
  ) {}
}
