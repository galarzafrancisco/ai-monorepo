import { IssueChange, IssueState } from '../enums';
import { IssueSnapshot } from './issue-snapshot';

type Comparable = Pick<IssueSnapshot, 'state' | 'assignees' | 'labels' | 'commentCount'>;

/**
 * What happened between two snapshots, in the order a person would tell it.
 * The first snapshot of an issue has nothing to compare with: no changes.
 */
export function diffIssue(before: Comparable | null, after: Comparable): IssueChange[] {
  if (!before) return [];
  const changes: IssueChange[] = [];

  if (before.state !== after.state) {
    changes.push(after.state === IssueState.CLOSED ? IssueChange.CLOSED : IssueChange.REOPENED);
  }
  const assigned = new Set(before.assignees.map((login) => login.toLowerCase()));
  if (after.assignees.some((login) => !assigned.has(login.toLowerCase()))) changes.push(IssueChange.ASSIGNED);
  const labeled = new Set(before.labels.map((label) => label.name.toLowerCase()));
  if (after.labels.some((label) => !labeled.has(label.name.toLowerCase()))) changes.push(IssueChange.LABELED);
  if (after.commentCount > before.commentCount) changes.push(IssueChange.NEW_COMMENTS);

  return changes;
}
