import { createVerify, generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:net';
import { createAppJwt, describeNetworkError, githubRequest } from './github-api';
import { GithubRequestFailedError } from '../errors/integrations.errors';

describe('createAppJwt', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

  it('signs an RS256 JWT issued by the app that lasts under ten minutes', () => {
    const now = Date.UTC(2026, 0, 1);
    const jwt = createAppJwt('12345', pem, now);
    const [header, payload, signature] = jwt.split('.');

    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    expect(claims.iss).toBe('12345');
    expect(claims.iat).toBe(now / 1000 - 60);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
    expect(claims.exp).toBeGreaterThan(now / 1000);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('throws for a key that is not PEM', () => {
    expect(() => createAppJwt('1', 'nope')).toThrow();
  });
});

describe('describeNetworkError', () => {
  const fetchFailed = (code: string, message: string) =>
    new TypeError('fetch failed', { cause: Object.assign(new Error(message), { code }) });

  it('says why fetch failed, from its cause', () => {
    expect(describeNetworkError(fetchFailed('ENOTFOUND', 'getaddrinfo ENOTFOUND github.acme.com'))).toMatch(
      /^getaddrinfo ENOTFOUND github\.acme\.com\. Check that the machine Taico runs on can reach/,
    );
  });

  it('points at the CA settings when the certificate is not trusted', () => {
    const described = describeNetworkError(fetchFailed('SELF_SIGNED_CERT_IN_CHAIN', 'self-signed certificate in certificate chain'));
    expect(described).toContain('self-signed certificate in certificate chain (SELF_SIGNED_CERT_IN_CHAIN)');
    expect(described).toContain('NODE_EXTRA_CA_CERTS');
  });

  it('keeps the message when there is no cause', () => {
    expect(describeNetworkError(new Error('boom'))).toBe('boom');
  });
});

describe('githubRequest', () => {
  it('names the address it could not reach and why', async () => {
    const apiUrl = `http://127.0.0.1:${await closedPort()}`;
    const request = githubRequest({ apiUrl, credential: null }, '/user');
    await expect(request).rejects.toBeInstanceOf(GithubRequestFailedError);
    await expect(request).rejects.toThrow(`Could not reach GitHub at ${apiUrl}: connect ECONNREFUSED`);
  });
});

/** A port nothing listens on. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
