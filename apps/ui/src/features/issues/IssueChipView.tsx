import { ExternalLink, MessageSquare } from 'lucide-react';
import { Popover } from '../../ui/primitives';
import type { Issue } from './api';
import { issueLabel, type IssueRef } from './issueLinks';
import { describeIssue, ISSUE_LOOK_ICON, issueLook, issueLookLabel } from './issueDisplay';
import './IssueChip.css';

export type IssueChipVariant =
  /** Task header: full name and a link out. */
  | 'full'
  /** Inside text: the name, colored by state. */
  | 'inline'
  /** Board cards: icon and number. */
  | 'compact';

export interface IssueChipViewProps {
  refInfo: IssueRef;
  url: string;
  /** Null while loading, or when the lookup failed. */
  issue: Issue | null;
  failed?: boolean;
  variant?: IssueChipVariant;
  /** Text to show instead of owner/repo#n, e.g. a link's own text. */
  label?: string;
}

/** The chip itself, drawn from an issue you already have. No store, no network: IssueChip feeds it live data. */
export function IssueChipView({ refInfo: ref, url, issue, failed = false, variant = 'full', label }: IssueChipViewProps) {
  const look = issueLook(issue);
  const Icon = ISSUE_LOOK_ICON[look];
  const name = label ?? (variant === 'compact' ? `#${ref.number}` : issueLabel(ref));
  const summary = issue ? describeIssue(issue) : failed ? 'Status unavailable' : 'Loading status';

  return (
    <span className={`issue-chip issue-chip--${variant}`} data-look={look} onClick={(event) => event.stopPropagation()}>
      <Popover
        triggerClassName="issue-chip__trigger"
        triggerLabel={`${issueLabel(ref)}: ${summary}`}
        className="issue-card"
        trigger={
          <>
            <Icon className="issue-chip__icon" size={variant === 'compact' ? 13 : 14} strokeWidth={2} aria-hidden="true" />
            <span className="issue-chip__name">{name}</span>
          </>
        }
      >
        <IssueCard refInfo={ref} url={url} issue={issue} failed={failed} />
      </Popover>
      {variant === 'full' ? (
        <a
          className="issue-chip__external"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${issueLabel(ref)} on GitHub`}
        >
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : null}
    </span>
  );
}

function IssueCard({ refInfo, url, issue, failed }: { refInfo: IssueRef; url: string; issue: Issue | null; failed: boolean }) {
  const look = issueLook(issue);
  const Icon = ISSUE_LOOK_ICON[look];
  return (
    <div className="issue-card__body" data-look={look}>
      <div className="issue-card__head">
        <span className="issue-card__state">
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          {issueLookLabel(issue)}
        </span>
        <span className="issue-card__ref">{issueLabel(refInfo)}</span>
      </div>

      {issue?.title ? <div className="issue-card__title">{issue.title}</div> : null}

      {issue?.state ? (
        <>
          <div className="issue-card__meta">
            {issue.authorLogin ? <span>Opened by @{issue.authorLogin}</span> : null}
            {issue.commentCount ? (
              <span className="issue-card__comments">
                <MessageSquare size={12} aria-hidden="true" /> {issue.commentCount}
              </span>
            ) : null}
          </div>
          {issue.labels.length > 0 ? (
            <div className="issue-card__labels">
              {issue.labels.map((item) => (
                <span key={item.name} className="issue-card__label">
                  {item.color ? (
                    // GitHub's own label color: data, not a theme color.
                    <span className="issue-card__label-dot" style={{ background: `#${item.color}` }} aria-hidden="true" />
                  ) : null}
                  {item.name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="issue-card__row">
            {issue.assignees.length > 0
              ? `Assigned to ${issue.assignees.map((login) => `@${login}`).join(', ')}`
              : 'No one assigned'}
          </div>
          {issue.milestone ? <div className="issue-card__row">Milestone: {issue.milestone}</div> : null}
        </>
      ) : (
        <div className="issue-card__row">{failed ? 'Taico could not load this issue.' : 'Loading…'}</div>
      )}

      {issue?.lastError ? <div className="issue-card__error">{issue.lastError}</div> : null}

      <a className="issue-card__link" href={url} target="_blank" rel="noopener noreferrer">
        Open on GitHub <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
}
