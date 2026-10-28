import { GITHUB_COM_HOST } from './github-host';

/** A repository on github.com or on a GitHub Enterprise. */
export type GithubRepoRef = {
  /** `github.com`, or the host of a GitHub Enterprise (lower case, with its port if any). */
  host: string;
  owner: string;
  repo: string;
};

/**
 * Reads the host, owner and name of a repository from a clone or web URL:
 * `https://github.com/acme/api(.git)`, `git@github.com:acme/api.git`,
 * `ssh://git@github.com/acme/api`. github.com is always recognised; a GitHub
 * Enterprise only when its host is in `enterpriseHosts` (the hosts of the
 * connections). Null for anything else.
 */
export function parseGithubRepoUrl(
  url: string | null | undefined,
  enterpriseHosts: Iterable<string> = [],
): GithubRepoRef | null {
  const value = url?.trim();
  if (!value) return null;
  const hosts = [GITHUB_COM_HOST, ...enterpriseHosts].map((host) => host.toLowerCase());

  const scp = value.match(/^[\w.-]+@([\w.-]+):([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  if (scp) {
    // SSH has its own port: match the host name alone.
    const host = hosts.find((candidate) => candidate.split(':')[0] === scp[1].toLowerCase());
    return host ? { host, owner: scp[2], repo: scp[3] } : null;
  }

  try {
    const parsed = new URL(value);
    const host =
      parsed.protocol === 'ssh:'
        ? hosts.find((candidate) => candidate.split(':')[0] === parsed.hostname.toLowerCase())
        : hosts.find((candidate) => candidate === parsed.host.toLowerCase());
    if (!host) return null;
    const [owner, repo] = parsed.pathname.replace(/^\/+/, '').split('/');
    if (!owner || !repo) return null;
    return { host, owner, repo: repo.replace(/\.git$/i, '') };
  } catch {
    return null;
  }
}
