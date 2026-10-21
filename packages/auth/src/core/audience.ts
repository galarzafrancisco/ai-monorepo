/**
 * Decides whether a token's audience makes it usable on a request.
 * `requestUrl` is the full public URL of the request, without query string.
 */
export interface AudiencePolicy {
  accepts(audience: string[], requestUrl: string): boolean;
  /**
   * The resource URLs the policy accepts tokens for, when it has a fixed list
   * (possibly empty). Undefined when it is open-ended or unknown.
   */
  readonly resourceUrls?: readonly string[];
}

export function toAudienceList(
  audience: string | string[] | undefined,
): string[] {
  return (Array.isArray(audience) ? audience : [audience]).filter(
    (aud): aud is string => typeof aud === 'string' && aud.length > 0,
  );
}

/** Compares two resource URIs as parsed URLs, tolerating one trailing slash */
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

/** Accepts tokens minted for one of these resource URLs, on any route */
export function exactResource(...resourceUrls: string[]): AudiencePolicy {
  return {
    resourceUrls,
    accepts: (audience) =>
      audience.some((aud) =>
        resourceUrls.some((resource) => isSameResource(resource, aud)),
      ),
  };
}

/** Accepts tokens whose audience is one of these literal values (not URLs) */
export function literalAudience(...values: string[]): AudiencePolicy {
  return {
    // Literal audiences name no resource URL
    resourceUrls: [],
    accepts: (audience) => audience.some((aud) => values.includes(aud)),
  };
}

/**
 * Accepts a token only on the URL it was minted for. For hosts that serve
 * several protected resources, each at its own URL.
 *
 * The request URL is compared as a plain string, on purpose. Parsing it would
 * resolve dot segments and percent-encoding that a router does not, so the
 * URL checked here could differ from the route that handles the request.
 */
export function requestUrlAudience(): AudiencePolicy {
  const withoutTrailingSlash = (value: string) => value.replace(/\/$/, '');
  return {
    accepts: (audience, requestUrl) =>
      audience.some(
        (aud) => withoutTrailingSlash(aud) === withoutTrailingSlash(requestUrl),
      ),
  };
}

/** Accepts a token when any of the given policies does */
export function anyAudience(...policies: AudiencePolicy[]): AudiencePolicy {
  // A fixed list only if every policy has one: a policy that accepts any
  // request URL (requestUrlAudience) makes the set of resources open
  const fixed = policies.every((policy) => policy.resourceUrls !== undefined);
  return {
    resourceUrls: fixed ? policies.flatMap((policy) => policy.resourceUrls ?? []) : undefined,
    accepts: (audience, requestUrl) =>
      policies.some((policy) => policy.accepts(audience, requestUrl)),
  };
}
