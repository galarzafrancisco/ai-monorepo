import { usePullRequest } from './pullRequestStore';
import { parsePullRequestUrl } from './pullRequestLinks';
import './LinkifiedText.css';
import { PullRequestChipView, type PullRequestChipVariant } from './PullRequestChipView';

export type { PullRequestChipVariant };

export interface PullRequestChipProps {
  url: string;
  variant?: PullRequestChipVariant;
  /** Text to show instead of owner/repo#n, e.g. a link's own text. */
  label?: string;
}

/**
 * A pull request link (github.com or a GitHub Enterprise) drawn with its live state: green open, gray
 * draft, purple merged, red closed, plus CI and approval. Hovering (or tapping,
 * on touch screens) opens a card with the details. Not a pull request link:
 * renders nothing, so callers check with parsePullRequestUrl first.
 */
export function PullRequestChip({ url, variant = 'full', label }: PullRequestChipProps) {
  const ref = parsePullRequestUrl(url);
  const entry = usePullRequest(ref);
  if (!ref) return null;
  if (entry?.status === 'unsupported') {
    return (
      <a className="linkified-text__link" href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
        {label ?? url}
      </a>
    );
  }
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
