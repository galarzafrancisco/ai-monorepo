/** A repository on github.com. */
export type GithubRepoRef = {
  owner: string;
  repo: string;
};

/**
 * Reads the owner and name of a github.com repository from a clone or web URL:
 * `https://github.com/acme/api(.git)`, `git@github.com:acme/api.git`,
 * `ssh://git@github.com/acme/api`. Null for anything else.
 */
export function parseGithubRepoUrl(url: string | null | undefined): GithubRepoRef | null {
  const value = url?.trim();
  if (!value) return null;

  const scp = value.match(/^[\w.-]+@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  if (scp) return { owner: scp[1], repo: scp[2] };

  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase() !== 'github.com') return null;
    const [owner, repo] = parsed.pathname.replace(/^\/+/, '').split('/');
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/i, '') };
  } catch {
    return null;
  }
}
