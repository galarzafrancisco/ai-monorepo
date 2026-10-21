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

/**
 * The resource URL a request URL falls under: the longest of `resourceUrls`
 * that is the request URL or a path prefix of it. Null when none is, or when
 * the request path has dot segments or encoded slashes or dots, which a
 * router could resolve to a path outside the prefix that was checked.
 */
export function resourceUnder(
  resourceUrls: readonly string[],
  requestUrl: string,
): string | null {
  const url = requestUrl.split(/[?#]/)[0].replace(/\/$/, '');
  if (/\/\.{1,2}(\/|$)|%2e|%2f|%5c|\\/i.test(url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, ''))) {
    return null;
  }
  let best: string | null = null;
  for (const resource of resourceUrls) {
    const base = resource.replace(/\/$/, '');
    const under = url === base || url.startsWith(`${base}/`);
    if (under && (best === null || base.length > best.replace(/\/$/, '').length)) {
      best = resource;
    }
  }
  return best;
}

/**
 * Accepts a token only under the resource it was minted for: on a request
 * to that resource's URL or a path below it. For one server that hosts
 * several resources (`/mcp/notes`, `/mcp/files`), so that a token for one
 * is refused on the other. A request under none of them is refused.
 */
export function resourceAudience(...resourceUrls: string[]): AudiencePolicy {
  return {
    resourceUrls,
    accepts: (audience, requestUrl) => {
      const resource = resourceUnder(resourceUrls, requestUrl);
      return resource !== null && audience.some((aud) => isSameResource(resource, aud));
    },
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
