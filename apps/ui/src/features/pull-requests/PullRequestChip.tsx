import { usePullRequest } from './pullRequestStore';
import { parsePullRequestUrl } from './pullRequestLinks';
import { PullRequestChipView, type PullRequestChipVariant } from './PullRequestChipView';

export type { PullRequestChipVariant };

export interface PullRequestChipProps {
  url: string;
  variant?: PullRequestChipVariant;
  /** Text to show instead of owner/repo#n, e.g. a link's own text. */
  label?: string;
}

/**
 * A GitHub pull request link drawn with its live state: green open, gray
 * draft, purple merged, red closed, plus CI and approval. Hovering (or tapping,
 * on touch screens) opens a card with the details. Not a pull request link:
 * renders nothing, so callers check with parsePullRequestUrl first.
 */
export function PullRequestChip({ url, variant = 'full', label }: PullRequestChipProps) {
  const ref = parsePullRequestUrl(url);
  const entry = usePullRequest(ref);
  if (!ref) return null;
  return (
    <PullRequestChipView
      refInfo={ref}
      url={url}
      pullRequest={entry?.status === 'ready' ? entry.pullRequest : null}
      failed={entry?.status === 'error'}
      variant={variant}
      label={label}
    />
  );
}
