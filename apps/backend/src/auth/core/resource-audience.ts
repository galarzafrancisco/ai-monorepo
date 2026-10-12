import {
  anyAudience,
  exactResource,
  literalAudience,
  requestUrlAudience,
  toAudienceList,
  type AudiencePolicy,
} from '@taico/auth';
import { getConfig } from 'src/config/env.config';
import { INTERNAL_WORKER_AUTH_TARGET_ID } from './constants/internal-auth-target.constant';

export { isSameResource } from '@taico/auth';

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
 * Audiences of tokens for the Taico API as a whole: browser sessions,
 * system-issued tokens (aud = issuer) and the internal worker / display
 * targets (aud = the REST API root).
 */
export function firstPartyAudience(): AudiencePolicy {
  const { issuerUrl } = getConfig();
  return anyAudience(
    literalAudience(
      WEB_SESSION_AUDIENCE,
      // TODO: remove once worker tokens minted before audiences became
      // resource URLs have expired (they are refreshed every few minutes).
      INTERNAL_WORKER_AUTH_TARGET_ID,
    ),
    exactResource(issuerUrl, `${issuerUrl}/api/v1`),
  );
}

export function isFirstPartyAudience(
  audience: string | string[] | undefined,
): boolean {
  return firstPartyAudience().accepts(toAudienceList(audience), '');
}

/**
 * Decides whether a token may be used on a request. Accepts first-party
 * tokens anywhere, and a token bound to one resource (an MCP server) only on
 * that resource's own URL. Rejects everything else, including tokens minted
 * for another MCP server and tokens without an audience.
 */
export function taicoAudiencePolicy(): AudiencePolicy {
  return anyAudience(firstPartyAudience(), requestUrlAudience());
}
