import { PullRequestChange } from '../../pull-requests/enums';
import { isFinishing, relevantChanges } from './pull-request-watch.conditions';

describe('relevantChanges', () => {
  it('keeps the changes a watch waits for', () => {
    expect(
      relevantChanges(['checks_finished'], [PullRequestChange.NEW_COMMENTS, PullRequestChange.CHECKS_FAILED]),
    ).toEqual([PullRequestChange.CHECKS_FAILED]);
    expect(relevantChanges(['approved'], [PullRequestChange.CHECKS_PASSED])).toEqual([]);
  });

  it('always keeps merging and closing', () => {
    expect(relevantChanges(['approved'], [PullRequestChange.MERGED])).toEqual([PullRequestChange.MERGED]);
    expect(isFinishing([PullRequestChange.CLOSED])).toBe(true);
    expect(isFinishing([PullRequestChange.APPROVED])).toBe(false);
  });
});
