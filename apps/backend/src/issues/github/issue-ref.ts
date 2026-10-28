import { GITHUB_COM_HOST, isGithubCom } from '../../integrations/github/github-host';

/** An issue on github.com or on a GitHub Enterprise. */
export type IssueRef = {
  /** github.com when left out, else the host of a GitHub Enterprise (`github.acme.com`). */
  host?: string;
  owner: string;
  repo: string;
  number: number;
};

/** GitHub logins and repository names: letters, digits, `-`, `_` and `.`. */
const PATH = String.raw`\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/issues\/(\d{1,9})(?![\d])`;
const GITHUB_COM_ISSUE_URL = new RegExp(String.raw`https?:\/\/(?:www\.)?(github\.com)${PATH}`, 'gi');

/** github.com, or a GitHub Enterprise host in lower case. */
export function issueHost(ref: IssueRef): string {
  return (ref.host ?? GITHUB_COM_HOST).toLowerCase();
}

/**
 * The lower-case key an issue is stored under: `owner/repo#number` on
 * github.com, `host/owner/repo#number` on a GitHub Enterprise.
 */
export function issueKey(ref: IssueRef): string {
  const host = issueHost(ref);
  const prefix = isGithubCom(host) ? '' : `${host}/`;
  return `${prefix}${ref.owner}/${ref.repo}#${ref.number}`.toLowerCase();
}

/** How people write it: `owner/repo#12`, with the host in front on a GitHub Enterprise. */
export function issueLabel(ref: IssueRef): string {
  const host = issueHost(ref);
  return `${isGithubCom(host) ? '' : `${host}/`}${ref.owner}/${ref.repo}#${ref.number}`;
}

export function issueUrl(ref: IssueRef): string {
  return `https://${issueHost(ref)}/${ref.owner}/${ref.repo}/issues/${ref.number}`;
}

/** Hosts an issue may live on besides github.com: those given, or any host at all. */
export type EnterpriseHosts = string[] | 'any';

function issueUrlPattern(enterpriseHosts: EnterpriseHosts): RegExp {
  if (enterpriseHosts === 'any') {
    return new RegExp(String.raw`https?:\/\/(?:www\.)?([A-Za-z0-9.-]+(?::\d{1,5})?)${PATH}`, 'gi');
  }
  if (enterpriseHosts.length === 0) return GITHUB_COM_ISSUE_URL;
  const hosts = ['github\\.com', ...enterpriseHosts.map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))];
  return new RegExp(String.raw`https?:\/\/(?:www\.)?(${hosts.join('|')})${PATH}`, 'gi');
}

/**
 * Every distinct issue linked in a text, in order of first appearance: on
 * github.com, and on the GitHub Enterprise hosts given (those Taico has
 * connections to). Links to an issue's comments (`/issues/12#issuecomment-1`)
 * count as the issue.
 */
export function extractIssueRefs(text: string | null | undefined, enterpriseHosts: EnterpriseHosts = []): IssueRef[] {
  if (!text) return [];
  const seen = new Set<string>();
  const refs: IssueRef[] = [];
  for (const match of text.matchAll(issueUrlPattern(enterpriseHosts))) {
    const host = match[1].toLowerCase();
    const ref: IssueRef = { owner: match[2], repo: match[3], number: Number(match[4]) };
    if (!isGithubCom(host)) ref.host = host;
    const key = issueKey(ref);
    if (ref.number < 1 || seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }
  return refs;
}

/**
 * An issue from a link (`https://github.com/o/r/issues/1`) or a short
 * reference (`o/r#1`, or `github.acme.com/o/r#1` on a GitHub Enterprise).
 */
export function parseIssueRef(value: string, enterpriseHosts: EnterpriseHosts = []): IssueRef | null {
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
  return extractIssueRefs(trimmed, enterpriseHosts)[0] ?? null;
}
