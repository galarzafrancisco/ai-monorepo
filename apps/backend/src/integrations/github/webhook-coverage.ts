/** What one webhook covers: a repository, or every repository of an owner. */
export type WebhookCoverage = {
  owner: string;
  /** Null: every repository of the owner. */
  repo: string | null;
};

type Payload = {
  repository?: { name?: string; owner?: { login?: string } };
  organization?: { login?: string };
  installation?: { account?: { login?: string } };
};

/**
 * Reads what the webhook that sent a delivery covers. GitHub says where the
 * webhook is set up in `X-GitHub-Hook-Installation-Target-Type`: on a
 * repository, an organization (all its repositories) or a GitHub App
 * (`integration`: every repository of the installation). Without that header,
 * the payload decides. Null when nothing names a repository or owner, like an
 * App's ping.
 */
export function webhookCoverageOf(targetType: string | undefined, body: unknown): WebhookCoverage | null {
  const payload = (body ?? {}) as Payload;
  const repoOwner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;

  switch (targetType) {
    case 'repository':
      return repoOwner && repo ? { owner: repoOwner, repo } : null;
    case 'organization': {
      const owner = payload.organization?.login ?? repoOwner;
      return owner ? { owner, repo: null } : null;
    }
    case 'integration': {
      const owner = payload.installation?.account?.login ?? repoOwner;
      return owner ? { owner, repo: null } : null;
    }
    default:
      if (repoOwner && repo) return { owner: repoOwner, repo };
      return payload.organization?.login ? { owner: payload.organization.login, repo: null } : null;
  }
}
