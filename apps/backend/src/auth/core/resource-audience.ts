import { getConfig } from 'src/config/env.config';

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
 * Audiences of tokens that are not bound to a single MCP server: browser
 * sessions, system-issued tokens (aud = issuer) and the internal worker /
 * display targets (aud = the whole REST API).
 */
function getFirstPartyAudiences(): string[] {
  const { issuerUrl } = getConfig();
  return [WEB_SESSION_AUDIENCE, issuerUrl, `${issuerUrl}/api/v1`];
}

/**
 * Decides whether a token may be used on an MCP server endpoint.
 * Accepts tokens minted for that server and first-party tokens. Rejects
 * everything else, including tokens minted for a different MCP server and
 * tokens without an audience.
 */
export function isAudienceAcceptedForMcpResource(
  audience: string | string[] | undefined,
  resourceUrl: string,
): boolean {
  const audiences = (Array.isArray(audience) ? audience : [audience]).filter(
    (aud): aud is string => typeof aud === 'string' && aud.length > 0,
  );
  const firstParty = getFirstPartyAudiences();
  return audiences.some(
    (aud) =>
      isSameResource(aud, resourceUrl) ||
      firstParty.some(
        (allowed) => allowed === aud || isSameResource(allowed, aud),
      ),
  );
}
