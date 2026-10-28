/**
 * An issue on github.com or a GitHub Enterprise. Mirrors
 * apps/backend/src/issues/github/issue-ref.ts.
 */
export type IssueRef = {
  /** Left out on github.com; the host of a GitHub Enterprise otherwise. */
  host?: string;
  owner: string;
  repo: string;
  number: number;
};

/**
 * Any host: links on a GitHub Enterprise look the same as on github.com. The
 * backend leaves out issues on hosts it has no connection to, and those are
 * then drawn as plain links.
 */
const ISSUE_URL =
  /^https?:\/\/(?:www\.)?([A-Za-z0-9.-]+(?::\d{1,5})?)\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/issues\/(\d{1,9})(?:[/?#].*)?$/;

/** The issue a URL points at (including comment anchors), or null. */
export function parseIssueUrl(url: string): IssueRef | null {
  const match = url.trim().match(ISSUE_URL);
  if (!match) return null;
  const number = Number(match[4]);
  if (number < 1) return null;
  const host = match[1].toLowerCase();
  const ref: IssueRef = { owner: match[2], repo: match[3], number };
  return host === 'github.com' ? ref : { host, ...ref };
}

/** The lower-case key the backend stores an issue under: the host goes first on a GitHub Enterprise. */
export function issueKey(ref: IssueRef): string {
  return issueLabel(ref).toLowerCase();
}

export function issueLabel(ref: IssueRef): string {
  return `${ref.host ? `${ref.host}/` : ''}${ref.owner}/${ref.repo}#${ref.number}`;
}

/** The same number as a pull request: GitHub serves pull requests at /issues/:n too. */
export function pullRequestUrlOf(ref: IssueRef): string {
  return `https://${ref.host ?? 'github.com'}/${ref.owner}/${ref.repo}/pull/${ref.number}`;
}
