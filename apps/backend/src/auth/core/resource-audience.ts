import { getConfig } from 'src/config/env.config';
import { INTERNAL_WORKER_AUTH_TARGET_ID } from './constants/internal-auth-target.constant';

/**
 * Audience of browser session tokens.
 */
export const WEB_SESSION_AUDIENCE = 'ai-backend';

/**
 * Version segment of the per-server authorization server URLs.
 * Servers are not versioned yet, so everything is advertised and minted as 0.0.0.
 */
export const MCP_AUTH_SERVER_VERSION = '0.0.0';

/**
 * Canonical resource URI of an HTTP MCP server (RFC 8707 / RFC 9728).
 * This is the value published as `resource` in protected resource metadata and
 * minted as `aud` in the access tokens for that server.
 */
export function getMcpServerResourceUrl(server: {
  providedId: string;
  url?: string | null;
}): string {
  if (!server.url) {
    throw new Error(
      `MCP server '${server.providedId}' has no URL and cannot be an OAuth protected resource.`,
    );
  }
  return server.url;
}

/**
 * Compares two resource URIs as parsed URLs, tolerating a single trailing slash.
 */
export function isSameResource(a: string, b: string): boolean {
  const normalize = (value: string): string | null => {
    try {
      const url = new URL(value);
      url.hash = '';
      return url.href.replace(/\/$/, '');
    } catch {
      return null;
    }
  };
  const [x, y] = [normalize(a), normalize(b)];
  return x !== null && x === y;
}

/**
 * Audiences of tokens for the Taico API as a whole: browser sessions,
 * system-issued tokens (aud = issuer) and the internal worker / display
 * targets (aud = the REST API root).
 */
export function isFirstPartyAudience(
  audience: string | string[] | undefined,
): boolean {
  const { issuerUrl } = getConfig();
  const firstParty = [issuerUrl, `${issuerUrl}/api/v1`];
  return toAudienceList(audience).some(
    (aud) =>
      aud === WEB_SESSION_AUDIENCE ||
      // TODO: remove once worker tokens minted before audiences became
      // resource URLs have expired (they are refreshed every few minutes).
      aud === INTERNAL_WORKER_AUTH_TARGET_ID ||
      firstParty.some((allowed) => isSameResource(allowed, aud)),
  );
}

/**
 * Decides whether a token may be used on a request to `requestUrl`.
 * Accepts first-party tokens anywhere, and a token bound to one resource
 * (an MCP server) only on that resource's own URL. Rejects everything else,
 * including tokens minted for another MCP server and tokens without an
 * audience.
 */
export function isAudienceAcceptedForRequest(
  audience: string | string[] | undefined,
  requestUrl: string,
): boolean {
  return (
    isFirstPartyAudience(audience) ||
    toAudienceList(audience).some((aud) => isSameResource(aud, requestUrl))
  );
}

function toAudienceList(audience: string | string[] | undefined): string[] {
  return (Array.isArray(audience) ? audience : [audience]).filter(
    (aud): aud is string => typeof aud === 'string' && aud.length > 0,
  );
}
