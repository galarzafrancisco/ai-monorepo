import { IssueEntity } from '../issue.entity';
import { IssueChange } from '../enums';

/**
 * An issue's stored state changed after a look at GitHub. `changes` is empty
 * for the first look (nothing to compare with) and for changes that matter
 * only for display, such as a new title.
 */
export class IssueUpdatedEvent {
  static readonly INTERNAL = Symbol('issues.IssueUpdatedEvent');

  readonly occurredAt: Date = new Date();

  constructor(
    public readonly issue: IssueEntity,
    public readonly changes: IssueChange[],
  ) {}
}
