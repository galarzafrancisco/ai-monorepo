const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// A redirect URI with its own scheme hands the authorization response to a
// native app (RFC 8252 section 7.1), and apps pick their scheme freely
// (cursor://, vscode://, com.example.app:/). These schemes are not app links:
// the browser handles them itself, by running or showing content, opening its
// own internal pages, or starting another kind of request.
const FORBIDDEN_SCHEMES = new Set(
  [
    'javascript',
    'data',
    'vbscript',
    'file',
    'blob',
    'filesystem',
    'about',
    'view-source',
    'chrome',
    'chrome-extension',
    'chrome-untrusted',
    'devtools',
    'edge',
    'brave',
    'opera',
    'vivaldi',
    'moz-extension',
    'resource',
    'jar',
    'safari-extension',
    'safari-web-extension',
    'ms-browser-extension',
    'res',
    'ws',
    'wss',
    'ftp',
    'sftp',
    'mailto',
    'tel',
    'sms',
    'intent',
  ].map((scheme) => `${scheme}:`),
);

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
    // "https:callback" also parses; only the absolute form is a redirect URI
    return uri.toLowerCase().startsWith('https://') && url.hostname !== '';
  }
  if (url.protocol === 'http:') {
    return (
      uri.toLowerCase().startsWith('http://') &&
      LOOPBACK_HOSTS.has(url.hostname)
    );
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
