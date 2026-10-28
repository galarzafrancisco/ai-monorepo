import { PullRequestEntity } from '../../pull-requests/pull-request.entity';
import { ChecksStatus, PullRequestChange, PullRequestState, ReviewDecision } from '../../pull-requests/enums';
import { pullRequestUrl } from '../../pull-requests/github/pull-request-ref';
import { ThreadWatchResult } from './thread-watches.service';

export const WATCH_PULL_REQUEST_TOOL = 'watch_pull_request';
export const STOP_WATCHING_TOOL = 'stop_watching';

function whatHappened(change: PullRequestChange, pullRequest: PullRequestEntity): string {
  switch (change) {
    case PullRequestChange.MERGED:
      return 'was merged';
    case PullRequestChange.CLOSED:
      return 'was closed without merging';
    case PullRequestChange.CHECKS_FAILED:
      return `failed CI (${pullRequest.failedChecks.join(', ') || 'a check failed'})`;
    case PullRequestChange.CHECKS_PASSED:
      return 'passed CI';
    case PullRequestChange.APPROVED:
      return 'was approved';
    case PullRequestChange.CHANGES_REQUESTED:
      return 'got a review asking for changes';
    case PullRequestChange.NEW_COMMENTS:
      return 'has new comments';
    case PullRequestChange.NEW_COMMITS:
      return 'has new commits';
    case PullRequestChange.READY_FOR_REVIEW:
      return 'is ready for review';
    default:
      return change.replace(/_/g, ' ');
  }
}

/** One line of the pull request's state, for the agent. */
export function describePullRequest(pullRequest: PullRequestEntity): string {
  const state = !pullRequest.state
    ? 'unknown state'
    : pullRequest.state === PullRequestState.OPEN && pullRequest.draft
      ? 'open (draft)'
      : pullRequest.state;
  const parts = [state];
  if (pullRequest.state === PullRequestState.OPEN) {
    const checks: Record<ChecksStatus, string> = {
      [ChecksStatus.NONE]: 'no CI checks',
      [ChecksStatus.PENDING]: `CI running (${pullRequest.checksPending} of ${pullRequest.checksTotal} checks pending)`,
      [ChecksStatus.SUCCESS]: `CI passed (${pullRequest.checksPassed} checks)`,
      [ChecksStatus.FAILURE]: `CI failing (${pullRequest.checksFailed} of ${pullRequest.checksTotal} failed: ${pullRequest.failedChecks.join(', ')})`,
    };
    parts.push(checks[pullRequest.checksStatus]);
    parts.push(
      pullRequest.reviewDecision === ReviewDecision.APPROVED
        ? `approved by ${pullRequest.approvals}`
        : pullRequest.reviewDecision === ReviewDecision.CHANGES_REQUESTED
          ? 'changes requested'
          : 'not reviewed yet',
    );
  }
  parts.push(`+${pullRequest.additions ?? 0} −${pullRequest.deletions ?? 0} in ${pullRequest.changedFiles ?? 0} files`);
  if (pullRequest.commentCount) parts.push(`${pullRequest.commentCount} comments`);
  return parts.join(', ');
}

export function formatPullRequestNotification(input: {
  watch: ThreadWatchResult;
  pullRequest: PullRequestEntity;
  changes: PullRequestChange[];
  final: boolean;
}): string {
  const { watch, pullRequest, changes, final } = input;
  const happened = changes.map((change) => whatHappened(change, pullRequest));
  return [
    `<watch-notification kind="pull_request" watch-id="${watch.id}" final="${final}">`,
    `Pull request ${watch.targetLabel} "${pullRequest.title ?? ''}" ${happened.join(' and ')}.`,
    `It is now: ${describePullRequest(pullRequest)}.`,
    `Link: ${pullRequestUrl(pullRequest)}`,
    ...(watch.waitingFor ? [`You are watching it because: ${watch.waitingFor}`] : []),
    'Tell the user what this means for what they were waiting for. Do not just repeat the status.',
    final
      ? `Note: You are no longer watching it. Call ${WATCH_PULL_REQUEST_TOOL} again if you need further updates.`
      : `Note: You are still watching it until ${watch.expiresAt.toISOString()}. Call ${STOP_WATCHING_TOOL} with watch id ${watch.id} if that is no longer needed.`,
    '</watch-notification>',
  ].join('\n');
}

export function formatPullRequestExpiry(watch: ThreadWatchResult): string {
  return [
    `<watch-notification kind="pull_request" watch-id="${watch.id}" final="true">`,
    `You stopped watching pull request ${watch.targetLabel}: the watch expired at ${watch.expiresAt.toISOString()} before it finished.`,
    ...(watch.waitingFor ? [`You were watching it because: ${watch.waitingFor}`] : []),
    `Tell the user only if they are still waiting on it. Call ${WATCH_PULL_REQUEST_TOOL} again to keep watching.`,
    '</watch-notification>',
  ].join('\n');
}
