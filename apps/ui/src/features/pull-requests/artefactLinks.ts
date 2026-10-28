import { parsePullRequestUrl, pullRequestKey } from './pullRequestLinks';

/**
 * A task's links split into pull requests (one per pull request, in order)
 * and the rest.
 */
export function splitArtefactLinks(artefacts: Array<{ link: string }>): {
  pullRequestUrls: string[];
  otherCount: number;
} {
  const seen = new Set<string>();
  const pullRequestUrls: string[] = [];
  let otherCount = 0;
  for (const artefact of artefacts) {
    const ref = parsePullRequestUrl(artefact.link);
    if (!ref) {
      otherCount += 1;
      continue;
    }
    const key = pullRequestKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    pullRequestUrls.push(artefact.link);
  }
  return { pullRequestUrls, otherCount };
}
