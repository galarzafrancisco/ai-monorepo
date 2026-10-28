/** The host of github.com, and of every connection that names no other. */
export const GITHUB_COM_HOST = 'github.com';
export const GITHUB_COM_URL = 'https://github.com';
const GITHUB_COM_API_URL = 'https://api.github.com';

/**
 * The web address of a GitHub a connection talks to, as typed in Settings:
 * `https://github.acme.com`, `github.acme.com/` or `https://acme.ghe.com`.
 * Returns the scheme and host (and port) only; null when it is not an http(s)
 * address. github.com and www.github.com become `https://github.com`.
 */
export function normalizeGithubUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return GITHUB_COM_URL;
  let parsed: URL;
  try {
    parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.username || parsed.password) return null;
  const host = parsed.host.toLowerCase();
  if (host === GITHUB_COM_HOST || host === `www.${GITHUB_COM_HOST}` || host === `api.${GITHUB_COM_HOST}`) {
    return GITHUB_COM_URL;
  }
  return `${parsed.protocol}//${host}`;
}

/** `github.com`, `github.acme.com`, `acme.ghe.com`: lower case, with the port when there is one. */
export function githubHostOf(baseUrl: string): string {
  return new URL(baseUrl).host.toLowerCase();
}

export function isGithubCom(host: string): boolean {
  return host.toLowerCase() === GITHUB_COM_HOST;
}

/**
 * Where the REST API of a GitHub lives:
 * - github.com: `https://api.github.com` (GITHUB_API_URL overrides it, for tests);
 * - GitHub Enterprise Cloud with data residency (`acme.ghe.com`): `https://api.acme.ghe.com`;
 * - GitHub Enterprise Server: `https://github.acme.com/api/v3`.
 */
export function githubApiUrlFor(baseUrl: string): string {
  const url = new URL(baseUrl);
  const host = url.host.toLowerCase();
  if (isGithubCom(host)) {
    return (process.env.GITHUB_API_URL?.trim() || GITHUB_COM_API_URL).replace(/\/+$/, '');
  }
  if (url.hostname.toLowerCase().endsWith('.ghe.com')) return `${url.protocol}//api.${host}`;
  return `${url.protocol}//${host}/api/v3`;
}
