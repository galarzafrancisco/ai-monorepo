import { createVerify, generateKeyPairSync } from 'node:crypto';
import { createAppJwt } from './github-api';

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
