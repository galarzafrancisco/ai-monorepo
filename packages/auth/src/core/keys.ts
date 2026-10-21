import {
  calculateJwkThumbprint,
  exportJWK,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  type CryptoKey,
  type JWK,
} from 'jose';
import type { KeyStore, StoredKey } from './ports.js';
import {
  silentLogger,
  systemClock,
  type Clock,
  type Logger,
} from './types.js';

export const SIGNING_ALGORITHM = 'RS256';

/** Where a verifier gets the public keys of an issuer */
export interface JwksSource {
  /**
   * `forceRefresh` asks for a fresh copy because a token named a key that is
   * not in the cached one. Sources rate-limit this themselves.
   */
  getKeys(options?: { forceRefresh?: boolean }): Promise<JWK[]>;
}

/** A fixed set of public keys */
export function staticJwks(keys: JWK[]): JwksSource {
  return { getKeys: async () => keys };
}

export type RemoteJwksOptions = {
  /** How long a fetched key set is reused. Default 10 minutes. */
  cacheTtlMs?: number;
  /** Minimum time between fetches, forced or not. Default 30 seconds. */
  cooldownMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

/**
 * Keys published by another server at a JWKS URL, cached in memory. On a
 * failed refresh the previous copy keeps being served.
 */
export function remoteJwks(
  url: string,
  options: RemoteJwksOptions = {},
): JwksSource {
  const {
    cacheTtlMs = 10 * 60_000,
    cooldownMs = 30_000,
    timeoutMs = 5_000,
  } = options;
  let keys: JWK[] | null = null;
  let fetchedAt = 0;
  let pending: Promise<JWK[]> | null = null;

  const load = async (): Promise<JWK[]> => {
    const response = await (options.fetch ?? fetch)(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`JWKS endpoint responded with HTTP ${response.status}`);
    }
    const body = (await response.json()) as { keys?: unknown };
    if (!Array.isArray(body.keys)) {
      throw new Error('JWKS endpoint did not return a key set');
    }
    return body.keys as JWK[];
  };

  return {
    async getKeys({ forceRefresh = false } = {}) {
      const age = Date.now() - fetchedAt;
      const fresh = age <= cacheTtlMs;
      const coolingDown = age <= cooldownMs;
      if (keys !== null && (coolingDown || (fresh && !forceRefresh))) {
        return keys;
      }
      pending ??= load().finally(() => {
        pending = null;
      });
      try {
        keys = await pending;
      } catch (error) {
        if (keys === null) throw error;
      }
      fetchedAt = Date.now();
      return keys;
    },
  };
}

export type KeyManagerOptions = {
  store: KeyStore;
  /** How long a key signs new tokens. Default 72 hours. */
  signingTtlHours?: number;
  /** How long after that it still verifies tokens. Default 72 hours. */
  verifyingTtlHours?: number;
  /** How long loaded keys are reused before asking the store again. Default 60 s. */
  cacheTtlMs?: number;
  clock?: Clock;
  logger?: Logger;
};

type SigningKey = { kid: string; algorithm: string; privateKey: CryptoKey };

const FORCED_REFRESH_COOLDOWN_MS = 5_000;

/**
 * Owns the issuer's signing keys: creates and rotates them, signs with the
 * active one, and publishes the public halves. Keys are cached in memory, so
 * signing and verifying do not query the store or re-import PEMs per token.
 */
export class KeyManager implements JwksSource {
  private readonly store: KeyStore;
  private readonly signingTtlMs: number;
  private readonly verifyingTtlMs: number;
  private readonly cacheTtlMs: number;
  private readonly clock: Clock;
  private readonly logger: Logger;

  private signing: { key: SigningKey; until: number } | null = null;
  private published: { keys: JWK[]; loadedAt: number } | null = null;
  private rotating: Promise<StoredKey> | null = null;

  constructor(options: KeyManagerOptions) {
    this.store = options.store;
    this.signingTtlMs = (options.signingTtlHours ?? 72) * 3_600_000;
    this.verifyingTtlMs = (options.verifyingTtlHours ?? 72) * 3_600_000;
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000;
    this.clock = options.clock ?? systemClock;
    this.logger = options.logger ?? silentLogger;
  }

  /** The key to sign with, created on first use and replaced when it expires */
  async getSigningKey(): Promise<SigningKey> {
    const now = this.clock.now();
    if (this.signing && this.signing.until > now.getTime()) {
      return this.signing.key;
    }

    const stored = (await this.store.findActive(now)) ?? (await this.rotate());
    const key: SigningKey = {
      kid: stored.kid,
      algorithm: stored.algorithm,
      privateKey: await importPKCS8(stored.privateKeyPem, stored.algorithm),
    };
    this.signing = {
      key,
      until: Math.min(
        stored.expiresAt.getTime(),
        now.getTime() + this.cacheTtlMs,
      ),
    };
    return key;
  }

  /** Creates a new signing key and retires the current one */
  async rotate(): Promise<StoredKey> {
    this.rotating ??= this.createKey().finally(() => {
      this.rotating = null;
    });
    return this.rotating;
  }

  private async createKey(): Promise<StoredKey> {
    const { publicKey, privateKey } = await generateKeyPair(SIGNING_ALGORITHM, {
      modulusLength: 2048,
      extractable: true,
    });
    const stored = await this.store.rotate({
      kid: await calculateJwkThumbprint(await exportJWK(publicKey)),
      algorithm: SIGNING_ALGORITHM,
      publicKeyPem: await exportSPKI(publicKey),
      privateKeyPem: await exportPKCS8(privateKey),
      expiresAt: new Date(this.clock.now().getTime() + this.signingTtlMs),
    });
    this.signing = null;
    this.published = null;
    this.logger.log(
      `Created signing key ${stored.kid}, signs until ${stored.expiresAt.toISOString()}`,
    );
    return stored;
  }

  /** Public keys that may still verify a token: the active one and recent ones */
  async getKeys({ forceRefresh = false } = {}): Promise<JWK[]> {
    const now = this.clock.now().getTime();
    if (this.published) {
      const age = now - this.published.loadedAt;
      const maxAge = forceRefresh ? FORCED_REFRESH_COOLDOWN_MS : this.cacheTtlMs;
      if (age >= 0 && age < maxAge) {
        return this.published.keys;
      }
    }

    const stored = await this.store.listVerifiable(
      new Date(now - this.verifyingTtlMs),
    );
    const keys = await Promise.all(
      stored.map(async (key) => ({
        ...(await exportJWK(await importSPKI(key.publicKeyPem, key.algorithm))),
        use: 'sig',
        alg: key.algorithm,
        kid: key.kid,
      })),
    );
    this.published = { keys, loadedAt: now };
    return keys;
  }

  /** The JWK Set document served at the JWKS endpoint */
  async getJwks(): Promise<{ keys: JWK[] }> {
    return { keys: await this.getKeys() };
  }
}
