import { Check, CircleX, ExternalLink, LoaderCircle, MessageSquare, X } from 'lucide-react';
import { Popover } from '../../ui/primitives';
import type { PullRequest } from './api';
import { pullRequestLabel, type PullRequestRef } from './pullRequestLinks';
import {
  checksLabel,
  describePullRequest,
  LOOK_ICON,
  LOOK_LABEL,
  pullRequestLook,
  reviewLabel,
  showsChecks,
} from './pullRequestDisplay';
import './PullRequestChip.css';

export type PullRequestChipVariant =
  /** Task header: full name, CI, approval, link out. */
  | 'full'
  /** Inside text: the name, colored by state. */
  | 'inline'
  /** Board cards: icon and number. */
  | 'compact';

export interface PullRequestChipViewProps {
  refInfo: PullRequestRef;
  url: string;
  /** Null while loading, or when the lookup failed. */
  pullRequest: PullRequest | null;
  failed?: boolean;
  variant?: PullRequestChipVariant;
  /** Text to show instead of owner/repo#n, e.g. a link's own text. */
  label?: string;
}

/**
 * The chip itself, drawn from a pull request you already have. No store, no
 * network: PullRequestChip feeds it live data, and the marketing demo feeds it
 * a scripted one.
 */
export function PullRequestChipView({ refInfo: ref, url, pullRequest, failed = false, variant = 'full', label }: PullRequestChipViewProps) {
  const look = pullRequestLook(pullRequest);
  const Icon = LOOK_ICON[look];
  const name = label ?? (variant === 'compact' ? `#${ref.number}` : pullRequestLabel(ref));
  const summary = pullRequest ? describePullRequest(pullRequest) : failed ? 'Status unavailable' : 'Loading status';

  return (
    <span className={`pr-chip pr-chip--${variant}`} data-look={look} onClick={(event) => event.stopPropagation()}>
      <Popover
        triggerClassName="pr-chip__trigger"
        triggerLabel={`${pullRequestLabel(ref)}: ${summary}`}
        className="pr-card"
        trigger={
          <>
            <Icon className="pr-chip__icon" size={variant === 'compact' ? 13 : 14} strokeWidth={2} aria-hidden="true" />
            <span className="pr-chip__name">{name}</span>
            {pullRequest && variant !== 'inline' ? <ChipIndicators pullRequest={pullRequest} /> : null}
          </>
        }
      >
        <PullRequestCard refInfo={ref} url={url} pullRequest={pullRequest} failed={failed} />
      </Popover>
      {variant === 'full' ? (
        <a
          className="pr-chip__external"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${pullRequestLabel(ref)} on GitHub`}
        >
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : null}
    </span>
  );
}

/** CI and approval at a glance. The card has the words. */
function ChipIndicators({ pullRequest }: { pullRequest: PullRequest }) {
  const checks = showsChecks(pullRequest) ? pullRequest.checksStatus : null;
  const approved = pullRequest.state === 'open' && pullRequest.reviewDecision === 'approved';
  if (!checks && !approved) return null;
  return (
    <span className="pr-chip__indicators" aria-hidden="true">
      {checks === 'pending' ? <LoaderCircle className="pr-chip__ci pr-chip__ci--pending" size={12} strokeWidth={2.5} /> : null}
      {checks === 'failure' ? <CircleX className="pr-chip__ci pr-chip__ci--failure" size={12} strokeWidth={2.5} /> : null}
      {checks === 'success' ? <span className="pr-chip__ci pr-chip__ci--success" /> : null}
      {approved ? <Check className="pr-chip__approved" size={12} strokeWidth={3} /> : null}
    </span>
  );
}

function PullRequestCard({
  refInfo,
  url,
  pullRequest,
  failed,
}: {
  refInfo: PullRequestRef;
  url: string;
  pullRequest: PullRequest | null;
  failed: boolean;
}) {
  const look = pullRequestLook(pullRequest);
  const Icon = LOOK_ICON[look];
  return (
    <div className="pr-card__body" data-look={look}>
      <div className="pr-card__head">
        <span className="pr-card__state">
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          {LOOK_LABEL[look]}
        </span>
        <span className="pr-card__ref">{pullRequestLabel(refInfo)}</span>
      </div>

      {pullRequest?.title ? <div className="pr-card__title">{pullRequest.title}</div> : null}

      {pullRequest?.state ? (
        <>
          {pullRequest.headRef && pullRequest.baseRef ? (
            <div className="pr-card__branch">
              {pullRequest.baseRef} ← {pullRequest.headRef}
              {pullRequest.authorLogin ? <span> · @{pullRequest.authorLogin}</span> : null}
            </div>
          ) : null}
          <div className="pr-card__stats">
            <span className="pr-card__additions">+{pullRequest.additions ?? 0}</span>
            <span className="pr-card__deletions">−{pullRequest.deletions ?? 0}</span>
            <span className="pr-card__muted">
              {pullRequest.changedFiles ?? 0} {pullRequest.changedFiles === 1 ? 'file' : 'files'}
            </span>
            {pullRequest.commentCount ? (
              <span className="pr-card__muted">
                <MessageSquare size={12} aria-hidden="true" /> {pullRequest.commentCount}
              </span>
            ) : null}
          </div>
          {pullRequest.checksStatus !== 'none' ? (
            <div className="pr-card__row" data-checks={pullRequest.checksStatus}>
              {pullRequest.checksStatus === 'pending' ? (
                <LoaderCircle className="pr-chip__ci--pending" size={13} aria-hidden="true" />
              ) : pullRequest.checksStatus === 'failure' ? (
                <CircleX size={13} aria-hidden="true" />
              ) : (
                <Check size={13} aria-hidden="true" />
              )}
              <span>
                {checksLabel(pullRequest)}
                {pullRequest.failedChecks.length > 0 ? `: ${pullRequest.failedChecks.slice(0, 3).join(', ')}` : ''}
              </span>
            </div>
          ) : null}
          <div className="pr-card__row" data-review={pullRequest.reviewDecision}>
            {pullRequest.reviewDecision === 'approved' ? (
              <Check size={13} aria-hidden="true" />
            ) : pullRequest.reviewDecision === 'changes_requested' ? (
              <X size={13} aria-hidden="true" />
            ) : null}
            <span>{reviewLabel(pullRequest)}</span>
          </div>
        </>
      ) : (
        <div className="pr-card__muted">
          {failed ? 'Taico could not load this pull request.' : 'Loading…'}
        </div>
      )}

      {pullRequest?.lastError ? <div className="pr-card__error">{pullRequest.lastError}</div> : null}

      <a className="pr-card__link" href={url} target="_blank" rel="noopener noreferrer">
        Open on GitHub <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
}
