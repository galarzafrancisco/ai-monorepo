export type RepoLink = {
  /** Browser link for http(s) repositories; null for SSH and other URLs. */
  href: string | null;
  /** Short, readable form, e.g. "github.com/acme/app". */
  label: string;
};

/**
 * Turns a stored repository URL into something we can show. Only http(s)
 * URLs become links; SSH URLs such as git@github.com:acme/app.git are shown
 * as text so we never render an unsafe or unopenable href.
 */
export function toRepoLink(repoUrl: string | undefined | null): RepoLink | null {
  const value = repoUrl?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const path = url.pathname.replace(/\.git$/, '').replace(/\/+$/, '');
      return { href: url.toString(), label: `${url.host}${path}` };
    }
  } catch {
    // Not a WHATWG URL (e.g. scp-style SSH). Fall through to plain text.
  }

  const scp = value.match(/^[^@\s]+@([^:\s]+):(.+?)(?:\.git)?$/);
  if (scp) {
    return { href: null, label: `${scp[1]}/${scp[2]}` };
  }
  return { href: null, label: value };
}
