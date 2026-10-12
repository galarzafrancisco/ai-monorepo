import { randomUUID } from 'node:crypto';
import type {
  Client,
  ClientStore,
  Grant,
  GrantStore,
  IssuedTokenStore,
  KeyStore,
  NewKey,
  ProtectedResource,
  RefreshTokenStore,
  ResourceRegistry,
  StoredIssuedToken,
  StoredKey,
  StoredRefreshToken,
} from '../core/ports.js';
import { isSameResource } from '../core/audience.js';
import { findResourceByPath } from '../core/resource-server.js';
import type { LocalUser, UserStore } from '../idp-local/index.js';

/*
 * In-memory implementations of every port, for tests and prototypes.
 * State lives in the process and is lost when it exits.
 */

export class MemoryKeyStore implements KeyStore {
  private keys: (StoredKey & { active: boolean })[] = [];

  async findActive(now: Date): Promise<StoredKey | null> {
    return this.keys.find((key) => key.active && key.expiresAt > now) ?? null;
  }

  async listVerifiable(cutoff: Date): Promise<StoredKey[]> {
    return this.keys.filter((key) => key.expiresAt > cutoff);
  }

  async rotate(next: NewKey): Promise<StoredKey> {
    for (const key of this.keys) key.active = false;
    const stored = { ...next, createdAt: new Date(), active: true };
    this.keys.unshift(stored);
    return stored;
  }
}

export class MemoryClientStore implements ClientStore {
  private readonly clients = new Map<string, Client>();

  async findByClientId(clientId: string): Promise<Client | null> {
    return this.clients.get(clientId) ?? null;
  }

  async save(client: Client): Promise<Client> {
    this.clients.set(client.clientId, { ...client });
    return client;
  }
}

export class MemoryGrantStore implements GrantStore {
  private readonly grants = new Map<string, Grant>();

  async create(grant: Omit<Grant, 'id' | 'createdAt'>): Promise<Grant> {
    const created = { ...grant, id: randomUUID(), createdAt: new Date() };
    this.grants.set(created.id, created);
    return { ...created };
  }

  async findById(id: string): Promise<Grant | null> {
    const grant = this.grants.get(id);
    return grant ? { ...grant } : null;
  }

  async findByCodeHash(codeHash: string): Promise<Grant | null> {
    for (const grant of this.grants.values()) {
      if (grant.codeHash === codeHash) return { ...grant };
    }
    return null;
  }

  async save(grant: Grant): Promise<Grant> {
    this.grants.set(grant.id, { ...grant });
    return grant;
  }

  async redeemCode(id: string): Promise<boolean> {
    const grant = this.grants.get(id);
    if (!grant || grant.status !== 'code_issued') return false;
    grant.status = 'exchanged';
    return true;
  }
}

export class MemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly tokens = new Map<string, StoredRefreshToken>();

  async store(token: Omit<StoredRefreshToken, 'revokedAt'>): Promise<void> {
    this.tokens.set(token.tokenHash, { ...token, revokedAt: null });
  }

  async find(tokenHash: string): Promise<StoredRefreshToken | null> {
    const token = this.tokens.get(tokenHash);
    return token ? { ...token } : null;
  }

  async consume(tokenHash: string, now: Date): Promise<boolean> {
    const token = this.tokens.get(tokenHash);
    if (!token || token.revokedAt) return false;
    token.revokedAt = now;
    return true;
  }

  async revokeByGrant(grantId: string, now: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.grantId === grantId) token.revokedAt ??= now;
    }
  }

  async revokeBySubject(
    subjectId: string,
    kind: StoredRefreshToken['kind'],
    now: Date,
  ): Promise<string[]> {
    const sessionIds = new Set<string>();
    for (const token of this.tokens.values()) {
      if (token.subjectId === subjectId && token.kind === kind) {
        token.revokedAt ??= now;
        if (token.sessionId && token.expiresAt > now) sessionIds.add(token.sessionId);
      }
    }
    return [...sessionIds];
  }
}

export class MemoryIssuedTokenStore implements IssuedTokenStore {
  private readonly tokens = new Map<string, StoredIssuedToken>();

  async record(token: Omit<StoredIssuedToken, 'revokedAt' | 'createdAt'>): Promise<void> {
    this.tokens.set(token.jti, { ...token, revokedAt: null, createdAt: new Date() });
  }

  async isRevoked(jti: string): Promise<boolean> {
    return !!this.tokens.get(jti)?.revokedAt;
  }

  async revoke(jti: string, expiresAt?: Date): Promise<void> {
    const token = this.tokens.get(jti);
    if (token) {
      token.revokedAt ??= new Date();
      return;
    }
    this.tokens.set(jti, {
      jti,
      subjectId: '',
      issuedBy: null,
      name: null,
      scopes: [],
      expiresAt: expiresAt ?? new Date(8.64e15),
      revokedAt: new Date(),
      createdAt: new Date(),
    });
  }

  async listBySubject(subjectId: string): Promise<StoredIssuedToken[]> {
    return [...this.tokens.values()].filter((token) => token.subjectId === subjectId);
  }
}

export class MemoryUserStore implements UserStore {
  private readonly users = new Map<string, LocalUser>();

  async findByEmail(email: string): Promise<LocalUser | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return { ...user };
    }
    return null;
  }

  async findById(id: string): Promise<LocalUser | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async save(user: LocalUser): Promise<LocalUser> {
    this.users.set(user.id, { ...user });
    return user;
  }
}

/** A fixed list of protected resources */
export function staticResources(resources: ProtectedResource[]): ResourceRegistry {
  return {
    async find(identifier) {
      return (
        resources.find(
          (resource) =>
            resource.id === identifier ||
            resource.identifier === identifier ||
            isSameResource(resource.resourceUrl, identifier),
        ) ?? null
      );
    },
    findByPath: (path) => findResourceByPath(resources, path),
  };
}

/** All the stores an `OAuthServer` needs, in memory */
export function memoryStores() {
  return {
    keys: new MemoryKeyStore(),
    clients: new MemoryClientStore(),
    grants: new MemoryGrantStore(),
    refreshTokens: new MemoryRefreshTokenStore(),
    issuedTokens: new MemoryIssuedTokenStore(),
  };
}
