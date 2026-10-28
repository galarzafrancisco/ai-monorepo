import { PullRequestChip } from '../pull-requests/PullRequestChip';
import { useIssue } from './issueStore';
import { parseIssueUrl, pullRequestUrlOf } from './issueLinks';
import { IssueChipView, type IssueChipVariant } from './IssueChipView';

export type { IssueChipVariant };

export interface IssueChipProps {
  url: string;
  variant?: IssueChipVariant;
  /** Text to show instead of owner/repo#n, e.g. a link's own text. */
  label?: string;
}

/**
 * An issue link (github.com or a GitHub Enterprise) drawn with its live state:
 * green open, purple closed, gray not planned. Hovering (or tapping, on touch
 * screens) opens a card with the details. An `/issues/n` link that GitHub says
 * is a pull request is drawn as a pull request. Not an issue link: renders
 * nothing, so callers check with parseIssueUrl first.
 */
export function IssueChip({ url, variant = 'full', label }: IssueChipProps) {
  const ref = parseIssueUrl(url);
  const entry = useIssue(ref);
  if (!ref) return null;
  if (entry?.status === 'unsupported') {
    return (
      <a className="linkified-text__link" href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
        {label ?? url}
      </a>
    );
  }
  if (entry?.status === 'ready' && entry.issue.isPullRequest) {
    return <PullRequestChip url={pullRequestUrlOf(ref)} variant={variant} label={label} />;
  }
  return (
    <IssueChipView
      refInfo={ref}
      url={url}
      issue={entry?.status === 'ready' ? entry.issue : null}
      failed={entry?.status === 'error'}
      variant={variant}
      label={label}
    />
  );
}
