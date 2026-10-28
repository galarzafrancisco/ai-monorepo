import { createSign } from 'node:crypto';
import { GithubRequestFailedError } from '../errors/integrations.errors';

const DEFAULT_GITHUB_API_URL = 'https://api.github.com';

/** GitHub's REST API. GITHUB_API_URL overrides it, for tests (and one day GitHub Enterprise Server). */
export function githubApiUrl(): string {
  return (process.env.GITHUB_API_URL?.trim() || DEFAULT_GITHUB_API_URL).replace(/\/+$/, '');
}
const GITHUB_API_VERSION = '2022-11-28';
const REQUEST_TIMEOUT_MS = 15_000;

export type GithubResponse<T> = {
  status: number;
  /** Null when GitHub answered 304 Not Modified. */
  data: T | null;
  etag: string | null;
};

export type GithubRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Sent as If-None-Match; a 304 answer does not count against the rate limit. */
  etag?: string | null;
};

/**
 * One call to the GitHub REST API. `credential` is a token or an app JWT; null
 * calls anonymously (public repositories only, low rate limit).
 *
 * Throws GithubRequestFailedError for any answer other than 2xx or 304, with
 * GitHub's own message when it gave one.
 */
export async function githubRequest<T>(
  credential: string | null,
  path: string,
  options: GithubRequestOptions = {},
): Promise<GithubResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'taico',
  };
  if (credential) headers.Authorization = `Bearer ${credential}`;
  if (options.etag) headers['If-None-Match'] = options.etag;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${githubApiUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GithubRequestFailedError(
      `Could not reach GitHub: ${error instanceof Error ? error.message : String(error)}`,
      null,
    );
  }

  const etag = response.headers.get('etag');
  if (response.status === 304) {
    return { status: 304, data: null, etag: etag ?? options.etag ?? null };
  }
  if (!response.ok) {
    throw new GithubRequestFailedError(await describeFailure(response), response.status);
  }
  const data = response.status === 204 ? null : ((await response.json()) as T);
  return { status: response.status, data, etag };
}

async function describeFailure(response: Response): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { message?: string };
    detail = body.message ?? '';
  } catch {
    // Not JSON; the status says enough.
  }
  const prefix = `GitHub answered ${response.status}`;
  return detail ? `${prefix}: ${detail}` : prefix;
}

/**
 * A JWT that authenticates as the GitHub App itself, valid for 9 minutes
 * (GitHub allows 10). `iat` is set a minute early to allow for clock drift.
 */
export function createAppJwt(appId: string, privateKeyPem: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000) - 60;
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 600 - 60, iss: appId }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(privateKeyPem).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
