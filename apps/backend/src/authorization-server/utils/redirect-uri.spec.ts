import {
  isAcceptableRedirectUri,
  isRegisteredRedirectUri,
} from './redirect-uri';

describe('isAcceptableRedirectUri', () => {
  it.each([
    'https://app.example.com/callback',
    'http://localhost:3000/callback',
    'http://127.0.0.1/callback',
    'http://[::1]:8080/callback',
    'cursor://anysphere.cursor-mcp/oauth/callback',
    'com.example.app:/oauth',
  ])('accepts %s', (uri) => {
    expect(isAcceptableRedirectUri(uri)).toBe(true);
  });

  it.each([
    ['plain http on a remote host', 'http://example.com/callback'],
    [
      'a host that only starts with localhost',
      'http://localhost.example.com/cb',
    ],
    ['a fragment', 'https://app.example.com/callback#frag'],
    ['an empty fragment', 'https://app.example.com/callback#'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['file:', 'file:///etc/passwd'],
    ["a browser's internal pages", 'chrome://settings/'],
    ['a browser extension page', 'chrome-extension://abcdefgh/page.html'],
    ['a websocket', 'wss://example.com/callback'],
    ['mailto:', 'mailto:someone@example.com'],
    ['an Android intent', 'intent://example.com/#Intent;scheme=http;end'],
    ['not a URL', 'not a url'],
  ])('refuses %s', (_name, uri) => {
    expect(isAcceptableRedirectUri(uri)).toBe(false);
  });
});

describe('isRegisteredRedirectUri', () => {
  it('matches a registered URI exactly', () => {
    const registered = ['https://app.example.com/callback'];
    expect(
      isRegisteredRedirectUri(registered, 'https://app.example.com/callback'),
    ).toBe(true);
    expect(
      isRegisteredRedirectUri(registered, 'https://app.example.com/callback/'),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri(
        registered,
        'https://app.example.com/callback?x=1',
      ),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri(
        registered,
        'https://app.example.com:8443/callback',
      ),
    ).toBe(false);
  });

  it('ignores the port of a loopback redirect URI', () => {
    const registered = [
      'http://127.0.0.1/callback',
      'http://localhost:3000/cb',
    ];
    expect(
      isRegisteredRedirectUri(registered, 'http://127.0.0.1:51234/callback'),
    ).toBe(true);
    expect(isRegisteredRedirectUri(registered, 'http://localhost:9/cb')).toBe(
      true,
    );
    expect(isRegisteredRedirectUri(registered, 'http://localhost/cb')).toBe(
      true,
    );
  });

  it('still matches the rest of a loopback redirect URI exactly', () => {
    const registered = ['http://127.0.0.1/callback'];
    expect(
      isRegisteredRedirectUri(registered, 'http://127.0.0.1:51234/other'),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri(registered, 'http://localhost:51234/callback'),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri(registered, 'https://127.0.0.1:51234/callback'),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri(
        registered,
        'http://127.0.0.1.example.com/callback',
      ),
    ).toBe(false);
  });

  it('does not treat a remote host as loopback because a loopback URI is registered', () => {
    expect(
      isRegisteredRedirectUri(
        ['http://127.0.0.1/callback'],
        'http://attacker.example:80/callback',
      ),
    ).toBe(false);
  });
});
