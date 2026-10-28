import { GITHUB_COM_HOST, isGithubCom } from '../../integrations/github/github-host';

/** A pull request on github.com or on a GitHub Enterprise. */
export type PullRequestRef = {
  /** github.com when left out, else the host of a GitHub Enterprise (`github.acme.com`). */
  host?: string;
  owner: string;
  repo: string;
  number: number;
};

/** GitHub logins and repository names: letters, digits, `-`, `_` and `.`. */
const PATH = String.raw`\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/pull\/(\d{1,9})(?![\d])`;
const GITHUB_COM_PULL_REQUEST_URL = new RegExp(String.raw`https?:\/\/(?:www\.)?(github\.com)${PATH}`, 'gi');

/** github.com, or a GitHub Enterprise host in lower case. */
export function pullRequestHost(ref: PullRequestRef): string {
  return (ref.host ?? GITHUB_COM_HOST).toLowerCase();
}

/**
 * The lower-case key a pull request is stored under: `owner/repo#number` on
 * github.com, `host/owner/repo#number` on a GitHub Enterprise.
 */
export function pullRequestKey(ref: PullRequestRef): string {
  const host = pullRequestHost(ref);
  const prefix = isGithubCom(host) ? '' : `${host}/`;
  return `${prefix}${ref.owner}/${ref.repo}#${ref.number}`.toLowerCase();
}

/** How people write it: `owner/repo#12`, with the host in front on a GitHub Enterprise. */
export function pullRequestLabel(ref: PullRequestRef): string {
  const host = pullRequestHost(ref);
  return `${isGithubCom(host) ? '' : `${host}/`}${ref.owner}/${ref.repo}#${ref.number}`;
}

export function pullRequestUrl(ref: PullRequestRef): string {
  return `https://${pullRequestHost(ref)}/${ref.owner}/${ref.repo}/pull/${ref.number}`;
}

/** Hosts a pull request may live on besides github.com: those given, or any host at all. */
export type EnterpriseHosts = string[] | 'any';

function pullRequestUrlPattern(enterpriseHosts: EnterpriseHosts): RegExp {
  if (enterpriseHosts === 'any') {
    return new RegExp(String.raw`https?:\/\/(?:www\.)?([A-Za-z0-9.-]+(?::\d{1,5})?)${PATH}`, 'gi');
  }
  if (enterpriseHosts.length === 0) return GITHUB_COM_PULL_REQUEST_URL;
  const hosts = ['github\\.com', ...enterpriseHosts.map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))];
  return new RegExp(String.raw`https?:\/\/(?:www\.)?(${hosts.join('|')})${PATH}`, 'gi');
}

/**
 * Every distinct pull request linked in a text, in order of first appearance:
 * on github.com, and on the GitHub Enterprise hosts given (those Taico has
 * connections to). Links to a pull request's tabs or comments
 * (`/pull/12/files`, `/pull/12#issuecomment-1`) count as the pull request.
 */
export function extractPullRequestRefs(
  text: string | null | undefined,
  enterpriseHosts: EnterpriseHosts = [],
): PullRequestRef[] {
  if (!text) return [];
  const seen = new Set<string>();
  const refs: PullRequestRef[] = [];
  for (const match of text.matchAll(pullRequestUrlPattern(enterpriseHosts))) {
    const host = match[1].toLowerCase();
    const ref: PullRequestRef = { owner: match[2], repo: match[3], number: Number(match[4]) };
    if (!isGithubCom(host)) ref.host = host;
    const key = pullRequestKey(ref);
    if (ref.number < 1 || seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }
  return refs;
}

/**
 * A pull request from a link (`https://github.com/o/r/pull/1`) or a short
 * reference (`o/r#1`, or `github.acme.com/o/r#1` on a GitHub Enterprise).
 */
export function parsePullRequestRef(value: string, enterpriseHosts: EnterpriseHosts = []): PullRequestRef | null {
  const trimmed = value.trim();
  const short = trimmed.match(/^(?:([A-Za-z0-9.:-]+\.[A-Za-z0-9.:-]+)\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)#(\d{1,9})$/);
  if (short) {
    const number = Number(short[4]);
    if (number < 1) return null;
    const host = short[1]?.toLowerCase();
    if (!host || isGithubCom(host)) return { owner: short[2], repo: short[3], number };
    return enterpriseHosts === 'any' || enterpriseHosts.some((known) => known.toLowerCase() === host)
      ? { host, owner: short[2], repo: short[3], number }
      : null;
  }
  return extractPullRequestRefs(trimmed, enterpriseHosts)[0] ?? null;
}
