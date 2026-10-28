import { parsePullRequestUrl, pullRequestKey } from './pullRequestLinks';
import { issueKey, parseIssueUrl } from '../issues/issueLinks';

/**
 * A task's links split into pull requests and issues (one per pull request or
 * issue, in order) and the rest.
 */
export function splitArtefactLinks(artefacts: Array<{ link: string }>): {
  pullRequestUrls: string[];
  issueUrls: string[];
  otherCount: number;
} {
  const seen = new Set<string>();
  const pullRequestUrls: string[] = [];
  const issueUrls: string[] = [];
  let otherCount = 0;
  for (const artefact of artefacts) {
    const pullRequest = parsePullRequestUrl(artefact.link);
    const issue = pullRequest ? null : parseIssueUrl(artefact.link);
    if (!pullRequest && !issue) {
      otherCount += 1;
      continue;
    }
    const key = pullRequest ? `pull:${pullRequestKey(pullRequest)}` : `issue:${issueKey(issue!)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (pullRequest ? pullRequestUrls : issueUrls).push(artefact.link);
  }
  return { pullRequestUrls, issueUrls, otherCount };
}
