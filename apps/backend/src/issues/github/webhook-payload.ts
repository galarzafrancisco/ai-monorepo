/** Issues a webhook delivery is about, by number. */
export type IssueWebhookTarget = {
  owner: string;
  repo: string;
  numbers: number[];
};

type Payload = {
  repository?: { name?: string; owner?: { login?: string } };
  issue?: { number?: number };
};

/**
 * Reads which issues a GitHub delivery concerns. Comments on pull requests
 * count too: GitHub serves pull requests as issues, and an `/issues/12` link
 * may point at one.
 */
export function issueTargetsOf(event: string | undefined, body: unknown): IssueWebhookTarget[] {
  if (event !== 'issues' && event !== 'issue_comment') return [];
  const payload = (body ?? {}) as Payload;
  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const number = payload.issue?.number;
  if (!owner || !repo || !Number.isInteger(number) || (number as number) < 1) return [];
  return [{ owner, repo, numbers: [number as number] }];
}
