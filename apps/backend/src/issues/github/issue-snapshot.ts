import { IssueState, IssueStateReason } from '../enums';

export type IssueLabel = { name: string; color: string | null };

/** What Taico knows about an issue after one look at GitHub. */
export type IssueSnapshot = {
  owner: string;
  repo: string;
  title: string;
  state: IssueState;
  stateReason: IssueStateReason | null;
  /** GitHub serves pull requests as issues too: an `/issues/12` link may be one. */
  isPullRequest: boolean;
  authorLogin: string | null;
  labels: IssueLabel[];
  assignees: string[];
  milestone: string | null;
  commentCount: number;
  closedAt: Date | null;
  githubUpdatedAt: Date | null;
};

const STATE_REASONS = new Set<string>(Object.values(IssueStateReason));

/** GitHub's `state_reason`, or null for one Taico does not know. */
export function toStateReason(value: string | null | undefined): IssueStateReason | null {
  return value && STATE_REASONS.has(value) ? (value as IssueStateReason) : null;
}

/** Labels come as objects, or as bare names from older APIs. Colors are hex without `#`. */
export function toLabels(labels: Array<string | { name?: string; color?: string | null }> | undefined): IssueLabel[] {
  return (labels ?? [])
    .map((label) =>
      typeof label === 'string'
        ? { name: label, color: null }
        : { name: label.name ?? '', color: label.color && /^[0-9a-f]{6}$/i.test(label.color) ? label.color.toLowerCase() : null },
    )
    .filter((label) => label.name.length > 0);
}
