import { AuthErrorCodes } from './errors.js';

export type ChallengeOptions = {
  /** URL of the RFC 9728 protected resource metadata for the request */
  resourceMetadataUrl?: string;
  realm?: string;
};

export type Challenge = {
  status: 401 | 403;
  /** Value of the WWW-Authenticate header (RFC 6750 section 3) */
  header: string;
};

const quote = (value: string) => `"${value.replace(/[\\"]/g, '\\$&')}"`;

/**
 * Builds the Bearer challenge for an authentication error, or null when the
 * error is not one a challenge answers.
 */
export function buildChallenge(
  error: { code: string; requiredScopes?: string[] },
  options: ChallengeOptions = {},
): Challenge | null {
  const params: string[] = [];
  if (options.realm) {
    params.push(`realm=${quote(options.realm)}`);
  }
  if (options.resourceMetadataUrl) {
    params.push(`resource_metadata=${quote(options.resourceMetadataUrl)}`);
  }

  let status: 401 | 403 = 401;
  switch (error.code) {
    case AuthErrorCodes.MISSING_ACCESS_TOKEN:
      // RFC 6750: no error code when the request carried no credentials
      break;
    case AuthErrorCodes.INVALID_ACCESS_TOKEN:
    case AuthErrorCodes.TOKEN_EXPIRED:
    case AuthErrorCodes.INVALID_TOKEN_SIGNATURE:
    case AuthErrorCodes.TOKEN_REVOKED:
      params.push(
        'error="invalid_token"',
        'error_description="The access token is invalid or has expired"',
      );
      break;
    case AuthErrorCodes.INSUFFICIENT_SCOPE: {
      status = 403;
      params.push('error="insufficient_scope"');
      const scopes = error.requiredScopes ?? [];
      if (scopes.length > 0) {
        params.push(`scope=${quote(scopes.join(' '))}`);
      }
      break;
    }
    default:
      return null;
  }

  return {
    status,
    header: params.length > 0 ? `Bearer ${params.join(', ')}` : 'Bearer',
  };
}

/** Bearer token from an Authorization header value, or null */
export function bearerTokenFrom(authorization: unknown): string | null {
  if (typeof authorization !== 'string' || authorization.length === 0) {
    return null;
  }
  const [scheme, ...rest] = authorization.split(' ');
  if (!scheme || rest.length === 0 || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

/** Parses a Cookie header. Later duplicates do not override earlier ones. */
export function parseCookies(header: unknown): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (typeof header !== 'string') {
    return cookies;
  }
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name || name in cookies) continue;
    const raw = part.slice(index + 1).trim().replace(/^"|"$/g, '');
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return cookies;
}
