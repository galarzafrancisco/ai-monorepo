const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Schemes that run or read content in the user's browser instead of handing
// the authorization response to an application.
const FORBIDDEN_SCHEMES = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'about:',
]);

function parse(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

/** True for http:// redirect URIs on the loopback interface (native apps, RFC 8252 section 7.3) */
export function isLoopbackRedirectUri(uri: string): boolean {
  const url = parse(uri);
  return (
    url !== null && url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
  );
}

/**
 * Whether a client may declare this redirect URI in its metadata document:
 * https, http on loopback only, or an application's own scheme.
 */
export function isAcceptableRedirectUri(uri: string): boolean {
  const url = parse(uri);
  if (!url || url.hash || uri.includes('#')) {
    return false;
  }
  if (url.protocol === 'https:') {
    return true;
  }
  if (url.protocol === 'http:') {
    return LOOPBACK_HOSTS.has(url.hostname);
  }
  return !FORBIDDEN_SCHEMES.has(url.protocol);
}

/**
 * Checks the redirect URI of an authorization request against the client's
 * registered ones. The match is exact, except that the port of a loopback
 * redirect URI is ignored: native apps listen on a port picked at run time
 * (RFC 8252 section 7.3).
 */
export function isRegisteredRedirectUri(
  registeredUris: string[],
  requestedUri: string,
): boolean {
  if (registeredUris.includes(requestedUri)) {
    return true;
  }
  if (!isLoopbackRedirectUri(requestedUri)) {
    return false;
  }

  const withoutPort = (uri: string): string => {
    const url = new URL(uri);
    url.port = '';
    return url.href;
  };
  const requested = withoutPort(requestedUri);
  return registeredUris.some(
    (registered) =>
      isLoopbackRedirectUri(registered) &&
      withoutPort(registered) === requested,
  );
}
