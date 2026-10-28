/** Pull requests a webhook delivery is about: by number, or by the commit at their head. */
export type WebhookTarget = {
  owner: string;
  repo: string;
  numbers?: number[];
  headSha?: string | null;
};

type Payload = {
  repository?: { name?: string; owner?: { login?: string } };
  pull_request?: { number?: number };
  issue?: { number?: number; pull_request?: unknown };
  check_run?: { head_sha?: string; pull_requests?: Array<{ number?: number }> };
  check_suite?: { head_sha?: string; pull_requests?: Array<{ number?: number }> };
  sha?: string;
};

/**
 * Reads which pull requests a GitHub delivery concerns. Events Taico does not
 * show anything for (pushes, issues, pings) concern none.
 */
export function pullRequestTargetsOf(event: string | undefined, body: unknown): WebhookTarget[] {
  const payload = (body ?? {}) as Payload;
  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  if (!owner || !repo) return [];
  const numbers = (values: Array<number | undefined>) =>
    values.filter((value): value is number => Number.isInteger(value) && (value as number) > 0);

  switch (event) {
    case 'pull_request':
    case 'pull_request_review':
    case 'pull_request_review_comment':
    case 'pull_request_review_thread':
      return [{ owner, repo, numbers: numbers([payload.pull_request?.number]) }];
    case 'issue_comment':
      // Comments on issues arrive here too; only pull requests have `issue.pull_request`.
      return payload.issue?.pull_request ? [{ owner, repo, numbers: numbers([payload.issue.number]) }] : [];
    case 'check_run':
    case 'check_suite': {
      const subject = payload.check_run ?? payload.check_suite;
      return [
        {
          owner,
          repo,
          numbers: numbers((subject?.pull_requests ?? []).map((pr) => pr.number)),
          headSha: subject?.head_sha ?? null,
        },
      ];
    }
    case 'status':
      return [{ owner, repo, headSha: payload.sha ?? null }];
    default:
      return [];
  }
}
