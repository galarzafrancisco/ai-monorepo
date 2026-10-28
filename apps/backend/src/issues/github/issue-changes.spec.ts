import { IssueChange, IssueState } from '../enums';
import { diffIssue } from './issue-changes';

describe('diffIssue', () => {
  const open = { state: IssueState.OPEN, assignees: ['octocat'], labels: [{ name: 'bug', color: 'd73a4a' }], commentCount: 2 };

  it('has nothing to say about a first look or an unchanged issue', () => {
    expect(diffIssue(null, open)).toEqual([]);
    expect(diffIssue(open, { ...open, assignees: ['OctoCat'] })).toEqual([]);
  });

  it('tells closing and reopening', () => {
    expect(diffIssue(open, { ...open, state: IssueState.CLOSED })).toEqual([IssueChange.CLOSED]);
    expect(diffIssue({ ...open, state: IssueState.CLOSED }, open)).toEqual([IssueChange.REOPENED]);
  });

  it('tells new assignees, labels and comments, not removals', () => {
    expect(
      diffIssue(open, {
        ...open,
        assignees: ['octocat', 'hubot'],
        labels: [{ name: 'bug', color: null }, { name: 'urgent', color: null }],
        commentCount: 3,
      }),
    ).toEqual([IssueChange.ASSIGNED, IssueChange.LABELED, IssueChange.NEW_COMMENTS]);
    expect(diffIssue(open, { ...open, assignees: [], labels: [], commentCount: 1 })).toEqual([]);
  });
});
