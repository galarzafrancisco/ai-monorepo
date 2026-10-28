import { CircleCheck, CircleDot, CircleSlash, type LucideIcon } from 'lucide-react';
import type { Issue } from './api';

export type IssueLook = 'open' | 'completed' | 'not_planned' | 'unknown';

/** How an issue is drawn: GitHub's icon and color for its state and why it was closed. */
export function issueLook(issue: Issue | null | undefined): IssueLook {
  if (!issue?.state) return 'unknown';
  if (issue.state === 'open') return 'open';
  return issue.stateReason === 'not_planned' || issue.stateReason === 'duplicate' ? 'not_planned' : 'completed';
}

export const ISSUE_LOOK_ICON: Record<IssueLook, LucideIcon> = {
  open: CircleDot,
  completed: CircleCheck,
  not_planned: CircleSlash,
  unknown: CircleDot,
};

export function issueLookLabel(issue: Issue | null | undefined): string {
  const look = issueLook(issue);
  if (look === 'open') return 'Open';
  if (look === 'completed') return 'Closed';
  if (look === 'not_planned') return issue?.stateReason === 'duplicate' ? 'Closed as duplicate' : 'Closed as not planned';
  return 'Issue';
}

/** A one-line summary for tooltips and screen readers. */
export function describeIssue(issue: Issue): string {
  const parts = [issueLookLabel(issue)];
  if (issue.assignees.length > 0) parts.push(`assigned to ${issue.assignees.map((login) => `@${login}`).join(', ')}`);
  return parts.join(', ');
}
