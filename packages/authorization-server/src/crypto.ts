import { exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT, type JWK, type JWTPayload } from 'jose';

import { InvalidTokenError, InsufficientScopeError } from './errors.js';
import type { AuthContext, AuthorizationStorage, IssueTokenInput, IssuedToken, KeyStore, ValidateTokenOptions } from './types.js';

const DEFAULT_TTL_SECONDS = 900;

export async function createDatabaseKeyStore(storage: AuthorizationStorage): Promise<KeyStore> {
  return {
    async getActiveSigningKey() {
      const existing = await storage.getActiveSigningKey?.();
      if (existing) return existing;
      const { privateKey } = await generateKeyPair('RS256', { extractable: true });
      const jwk = await exportJWK(privateKey);
      const key = { ...jwk, kid: crypto.randomUUID(), alg: 'RS256', use: 'sig' } satisfies JWK;
      await storage.saveSigningKey?.(key);
      return key;
    },
    async listPublicKeys() {
      const keys = await storage.listPublicSigningKeys?.();
      return keys ?? [];
    },
    async rotate() {
      const { privateKey } = await generateKeyPair('RS256', { extractable: true });
      const jwk = await exportJWK(privateKey);
      await storage.saveSigningKey?.({ ...jwk, kid: crypto.randomUUID(), alg: 'RS256', use: 'sig' });
    },
  };
}

export async function issueJwt(input: IssueTokenInput & { issuer: string; keys: KeyStore; defaultTtlSeconds?: number }): Promise<IssuedToken> {
  const ttlSeconds = input.ttlSeconds ?? input.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS;
  const scopes = input.scopes ?? [];
  const privateJwk = await input.keys.getActiveSigningKey();
  const privateKey = await importJWK(privateJwk, privateJwk.alg ?? 'RS256');
  const payload: JWTPayload = {
    ...input.claims,
    principal: input.principal,
    scope: scopes.join(' '),
  };
  const signer = new SignJWT(payload)
    .setProtectedHeader({ alg: privateJwk.alg ?? 'RS256', kid: privateJwk.kid })
    .setSubject(input.subject)
    .setIssuer(input.issuer)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`);
  if (input.audience) signer.setAudience(input.audience);
  const accessToken = await signer.sign(privateKey);
  return { accessToken, tokenType: 'Bearer', expiresIn: ttlSeconds, scope: scopes.join(' ') };
}

export async function validateJwt(input: {
  token: string;
  issuer: string;
  keys: KeyStore;
  options?: ValidateTokenOptions;
}): Promise<AuthContext> {
  const publicKeys = await input.keys.listPublicKeys();
  const errors: unknown[] = [];
  for (const jwk of publicKeys) {
    try {
      const key = await importJWK(jwk, jwk.alg ?? 'RS256');
      const result = await jwtVerify(input.token, key, {
        issuer: input.issuer,
        audience: input.options?.audience,
      });
      const claims = result.payload as AuthContext['claims'];
      const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [];
      const missing = input.options?.requiredScopes?.filter((scope) => !scopes.includes(scope)) ?? [];
      if (missing.length > 0) throw new InsufficientScopeError(`Missing required scopes: ${missing.join(', ')}`);
      if (!claims.sub) throw new InvalidTokenError('Token has no subject');
      return {
        token: input.token,
        subject: claims.sub,
        principal: claims.principal,
        scopes,
        claims,
      };
    } catch (error) {
      if (error instanceof InsufficientScopeError) throw error;
      errors.push(error);
    }
  }
  throw new InvalidTokenError(errors.length > 0 ? 'Token verification failed' : 'No signing keys available');
}

export function normalizeScopes(scopes: Array<string | { id: string; description?: string }> = []): Array<{ id: string; description?: string }> {
  return scopes.map((scope) => (typeof scope === 'string' ? { id: scope } : scope));
}
