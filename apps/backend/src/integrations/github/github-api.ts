import { createSign } from 'node:crypto';
import { GithubRequestFailedError } from '../errors/integrations.errors';

const GITHUB_API_VERSION = '2022-11-28';
const REQUEST_TIMEOUT_MS = 15_000;

export type GithubResponse<T> = {
  status: number;
  /** Null when GitHub answered 304 Not Modified. */
  data: T | null;
  etag: string | null;
};

/** Which GitHub to call, and as whom. */
export type GithubApi = {
  /** The REST API root, from githubApiUrlFor. */
  apiUrl: string;
  /** A token or an app JWT; null calls anonymously (public repositories only, low rate limit). */
  credential: string | null;
};

export type GithubRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Sent as If-None-Match; a 304 answer does not count against the rate limit. */
  etag?: string | null;
};

/**
 * One call to the REST API of github.com or a GitHub Enterprise.
 *
 * Throws GithubRequestFailedError for any answer other than 2xx or 304, with
 * GitHub's own message when it gave one.
 */
export async function githubRequest<T>(
  api: GithubApi,
  path: string,
  options: GithubRequestOptions = {},
): Promise<GithubResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'taico',
  };
  if (api.credential) headers.Authorization = `Bearer ${api.credential}`;
  if (options.etag) headers['If-None-Match'] = options.etag;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${api.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GithubRequestFailedError(`Could not reach GitHub at ${api.apiUrl}: ${describeNetworkError(error)}`, null);
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

/**
 * Why fetch could not get an answer. Node only says "fetch failed"; the reason
 * (DNS, refused connection, an untrusted certificate, a timeout) is in `cause`.
 */
export function describeNetworkError(error: unknown): string {
  // Duck-typed: fetch's errors may come from another realm, where instanceof Error fails.
  const failure = error as { name?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  if (typeof failure?.message !== 'string') return String(error);
  if (failure.name === 'TimeoutError') return `no answer within ${REQUEST_TIMEOUT_MS / 1000} seconds`;
  const code = typeof failure.cause?.code === 'string' ? failure.cause.code : undefined;
  const reason = typeof failure.cause?.message === 'string' && failure.cause.message ? failure.cause.message : failure.message;
  const detail = code && !reason.includes(code) ? `${reason} (${code})` : reason;
  const hint = code ? NETWORK_HINTS[code] : undefined;
  return hint ? `${detail}. ${hint}` : detail;
}

const CERTIFICATE_HINT =
  "Taico does not trust the server's certificate: if a company proxy or an internal CA signs it, give Node the CA with NODE_EXTRA_CA_CERTS or NODE_OPTIONS=--use-system-ca.";
const UNREACHABLE_HINT =
  'Check that the machine Taico runs on can reach this address; behind a company proxy, set HTTPS_PROXY and NODE_USE_ENV_PROXY=1.';

const NETWORK_HINTS: Record<string, string> = {
  ENOTFOUND: UNREACHABLE_HINT,
  EAI_AGAIN: UNREACHABLE_HINT,
  ECONNREFUSED: UNREACHABLE_HINT,
  ECONNRESET: UNREACHABLE_HINT,
  ETIMEDOUT: UNREACHABLE_HINT,
  ENETUNREACH: UNREACHABLE_HINT,
  EHOSTUNREACH: UNREACHABLE_HINT,
  UND_ERR_CONNECT_TIMEOUT: UNREACHABLE_HINT,
  SELF_SIGNED_CERT_IN_CHAIN: CERTIFICATE_HINT,
  DEPTH_ZERO_SELF_SIGNED_CERT: CERTIFICATE_HINT,
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: CERTIFICATE_HINT,
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: CERTIFICATE_HINT,
  CERT_HAS_EXPIRED: CERTIFICATE_HINT,
  ERR_TLS_CERT_ALTNAME_INVALID: CERTIFICATE_HINT,
};

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
