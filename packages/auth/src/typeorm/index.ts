import { randomUUID } from 'node:crypto';
import {
  EntitySchema,
  MoreThan,
  Table,
  type DataSource,
  type EntityManager,
  type MigrationInterface,
  type QueryRunner,
  type ValueTransformer,
} from 'typeorm';
import type {
  Client,
  ClientStore,
  Grant,
  GrantStore,
  IssuedTokenStore,
  KeyStore,
  NewKey,
  RefreshTokenStore,
  StoredIssuedToken,
  StoredKey,
  StoredRefreshToken,
} from '../core/ports.js';
import type { LocalUser, UserStore } from '../idp-local/index.js';

/*
 * TypeORM adapter. Tables are declared with EntitySchema, not decorators, and
 * only use column types every TypeORM driver has: text, bigint and boolean.
 * Timestamps are epoch milliseconds, so no driver's timezone handling applies.
 * Subject and resource IDs are plain text with no foreign key; a host can add
 * foreign keys to its own tables in its own migrations.
 */

const timestamp: ValueTransformer = {
  to: (value: Date | null | undefined) => (value ? value.getTime() : null),
  from: (value: string | number | null) => (value === null ? null : new Date(Number(value))),
};

const jsonText: ValueTransformer = {
  to: (value: unknown) => (value === null || value === undefined ? null : JSON.stringify(value)),
  from: (value: string | null) => (value === null ? null : JSON.parse(value)),
};

const text = { type: 'text' } as const;
const nullableText = { type: 'text', nullable: true } as const;
const time = { type: 'bigint', transformer: timestamp } as const;
const nullableTime = { type: 'bigint', nullable: true, transformer: timestamp } as const;
const json = { type: 'text', transformer: jsonText } as const;
const nullableJson = { type: 'text', nullable: true, transformer: jsonText } as const;

type KeyRow = StoredKey & { active: boolean };

export const AuthKeyEntity = new EntitySchema<KeyRow>({
  name: 'AuthKey',
  tableName: 'auth_keys',
  columns: {
    kid: { ...text, primary: true },
    algorithm: text,
    publicKeyPem: { ...text, name: 'public_key_pem' },
    privateKeyPem: { ...text, name: 'private_key_pem' },
    active: { type: 'boolean', default: true },
    expiresAt: { ...time, name: 'expires_at' },
    createdAt: { ...time, name: 'created_at' },
  },
});

export const AuthClientEntity = new EntitySchema<Client>({
  name: 'AuthClient',
  tableName: 'auth_clients',
  columns: {
    clientId: { ...text, name: 'client_id', primary: true },
    clientName: { ...text, name: 'client_name' },
    redirectUris: { ...json, name: 'redirect_uris' },
    grantTypes: { ...json, name: 'grant_types' },
    tokenEndpointAuthMethod: { ...text, name: 'token_endpoint_auth_method' },
    registrationMethod: { ...text, name: 'registration_method' },
    scopes: json,
    contacts: nullableJson,
    jwksUri: { ...nullableText, name: 'jwks_uri' },
    jwks: nullableJson,
    tokenEndpointAuthSigningAlg: {
      ...nullableText,
      name: 'token_endpoint_auth_signing_alg',
    },
    metadataExpiresAt: { ...nullableTime, name: 'metadata_expires_at' },
    createdAt: { ...time, name: 'created_at' },
  },
});

export const AuthGrantEntity = new EntitySchema<Grant>({
  name: 'AuthGrant',
  tableName: 'auth_grants',
  columns: {
    id: { ...text, primary: true },
    clientId: { ...text, name: 'client_id' },
    resourceId: { ...text, name: 'resource_id' },
    resource: text,
    scopes: json,
    redirectUri: { ...text, name: 'redirect_uri' },
    state: nullableText,
    codeChallenge: { ...text, name: 'code_challenge' },
    codeChallengeMethod: { ...text, name: 'code_challenge_method' },
    status: text,
    subjectId: { ...nullableText, name: 'subject_id' },
    codeHash: { ...nullableText, name: 'code_hash' },
    codeExpiresAt: { ...nullableTime, name: 'code_expires_at' },
    createdAt: { ...time, name: 'created_at' },
  },
  indices: [{ name: 'idx_auth_grants_code_hash', columns: ['codeHash'] }],
});

export const AuthRefreshTokenEntity = new EntitySchema<StoredRefreshToken>({
  name: 'AuthRefreshToken',
  tableName: 'auth_refresh_tokens',
  columns: {
    tokenHash: { ...text, name: 'token_hash', primary: true },
    kind: text,
    subjectId: { ...text, name: 'subject_id' },
    grantId: { ...nullableText, name: 'grant_id' },
    sessionId: { ...nullableText, name: 'session_id' },
    clientId: { ...nullableText, name: 'client_id' },
    expiresAt: { ...time, name: 'expires_at' },
    revokedAt: { ...nullableTime, name: 'revoked_at' },
  },
  indices: [
    { name: 'idx_auth_refresh_tokens_grant', columns: ['grantId'] },
    { name: 'idx_auth_refresh_tokens_subject', columns: ['subjectId'] },
  ],
});

export const AuthIssuedTokenEntity = new EntitySchema<StoredIssuedToken>({
  name: 'AuthIssuedToken',
  tableName: 'auth_issued_tokens',
  columns: {
    jti: { ...text, primary: true },
    subjectId: { ...text, name: 'subject_id' },
    issuedBy: { ...nullableText, name: 'issued_by' },
    name: nullableText,
    scopes: json,
    expiresAt: { ...time, name: 'expires_at' },
    revokedAt: { ...nullableTime, name: 'revoked_at' },
    createdAt: { ...time, name: 'created_at' },
  },
  indices: [{ name: 'idx_auth_issued_tokens_subject', columns: ['subjectId'] }],
});

export const AuthUserEntity = new EntitySchema<LocalUser>({
  name: 'AuthUser',
  tableName: 'auth_users',
  columns: {
    id: { ...text, primary: true },
    email: { ...text, unique: true },
    passwordHash: { ...text, name: 'password_hash' },
    displayName: { ...nullableText, name: 'display_name' },
    isActive: { type: 'boolean', name: 'is_active', default: true },
    attributes: json,
    createdAt: { ...time, name: 'created_at' },
  },
});

/** Add these to the DataSource's `entities` */
export const authEntities = [
  AuthKeyEntity,
  AuthClientEntity,
  AuthGrantEntity,
  AuthRefreshTokenEntity,
  AuthIssuedTokenEntity,
  AuthUserEntity,
];

type Source = DataSource | EntityManager;

export class TypeOrmKeyStore implements KeyStore {
  constructor(private readonly source: Source) {}

  private get keys() {
    return this.source.getRepository(AuthKeyEntity);
  }

  async findActive(now: Date): Promise<StoredKey | null> {
    const active = await this.keys.find({ where: { active: true } });
    return (
      active
        .filter((key) => key.expiresAt > now)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    );
  }

  async listVerifiable(cutoff: Date): Promise<StoredKey[]> {
    // The key table holds a handful of rows, so filtering here keeps the
    // query free of driver-specific bigint comparisons.
    return (await this.keys.find())
      .filter((key) => key.expiresAt > cutoff)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async rotate(next: NewKey): Promise<StoredKey> {
    return this.source.transaction(async (manager) => {
      const keys = manager.getRepository(AuthKeyEntity);
      await keys.update({ active: true }, { active: false });
      return keys.save({ ...next, active: true, createdAt: new Date() });
    });
  }
}

export class TypeOrmClientStore implements ClientStore {
  constructor(private readonly source: Source) {}

  findByClientId(clientId: string): Promise<Client | null> {
    return this.source.getRepository(AuthClientEntity).findOneBy({ clientId });
  }

  save(client: Client): Promise<Client> {
    return this.source.getRepository(AuthClientEntity).save(client);
  }
}

export class TypeOrmGrantStore implements GrantStore {
  constructor(private readonly source: Source) {}

  private get grants() {
    return this.source.getRepository(AuthGrantEntity);
  }

  create(grant: Omit<Grant, 'id' | 'createdAt'>): Promise<Grant> {
    return this.grants.save({ ...grant, id: randomUUID(), createdAt: new Date() });
  }

  findById(id: string): Promise<Grant | null> {
    return this.grants.findOneBy({ id });
  }

  findByCodeHash(codeHash: string): Promise<Grant | null> {
    return this.grants.findOneBy({ codeHash });
  }

  save(grant: Grant): Promise<Grant> {
    return this.grants.save(grant);
  }

  async redeemCode(id: string): Promise<boolean> {
    // One conditional UPDATE: of two racing requests only one changes a row
    const result = await this.grants.update(
      { id, status: 'code_issued' },
      { status: 'exchanged' },
    );
    return result.affected === 1;
  }
}

export class TypeOrmRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly source: Source) {}

  private get tokens() {
    return this.source.getRepository(AuthRefreshTokenEntity);
  }

  async store(token: Omit<StoredRefreshToken, 'revokedAt'>): Promise<void> {
    await this.tokens.insert({ ...token, revokedAt: null });
  }

  find(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.tokens.findOneBy({ tokenHash });
  }

  private async revokeWhere(where: string, parameters: object, now: Date): Promise<number> {
    const result = await this.tokens
      .createQueryBuilder()
      .update()
      .set({ revokedAt: now })
      .where(`${where} AND revoked_at IS NULL`, parameters)
      .execute();
    return result.affected ?? 0;
  }

  async consume(tokenHash: string, now: Date): Promise<boolean> {
    return (await this.revokeWhere('token_hash = :tokenHash', { tokenHash }, now)) === 1;
  }

  async revokeByGrant(grantId: string, now: Date): Promise<void> {
    await this.revokeWhere('grant_id = :grantId', { grantId }, now);
  }

  async revokeBySubject(
    subjectId: string,
    kind: StoredRefreshToken['kind'],
    now: Date,
  ): Promise<string[]> {
    await this.revokeWhere('subject_id = :subjectId AND kind = :kind', { subjectId, kind }, now);
    const tokens = await this.tokens.find({
      select: { sessionId: true },
      where: { subjectId, kind, expiresAt: MoreThan(now) },
    });
    return [...new Set(tokens.flatMap((token) => token.sessionId ?? []))];
  }
}

export class TypeOrmIssuedTokenStore implements IssuedTokenStore {
  constructor(private readonly source: Source) {}

  private get tokens() {
    return this.source.getRepository(AuthIssuedTokenEntity);
  }

  async record(token: Omit<StoredIssuedToken, 'revokedAt' | 'createdAt'>): Promise<void> {
    await this.tokens.insert({ ...token, revokedAt: null, createdAt: new Date() });
  }

  async isRevoked(key: string): Promise<boolean> {
    const token = await this.tokens.findOneBy({ jti: key });
    return !!token?.revokedAt;
  }

  async revoke(key: string, expiresAt?: Date): Promise<void> {
    const existing = await this.tokens.findOneBy({ jti: key });
    if (existing?.revokedAt) {
      return;
    }
    try {
      await this.tokens.save({
        jti: key,
        subjectId: '',
        issuedBy: null,
        name: null,
        scopes: [],
        expiresAt: expiresAt ?? new Date(8.64e15),
        createdAt: new Date(),
        ...existing,
        revokedAt: new Date(),
      });
    } catch (error) {
      // Two calls revoking the same unrecorded key both try to insert it.
      // The one that loses has nothing left to do.
      if (!(await this.isRevoked(key))) {
        throw error;
      }
    }
  }

  listBySubject(subjectId: string): Promise<StoredIssuedToken[]> {
    return this.tokens.findBy({ subjectId });
  }
}

export class TypeOrmUserStore implements UserStore {
  constructor(private readonly source: Source) {}

  private get users() {
    return this.source.getRepository(AuthUserEntity);
  }

  findByEmail(email: string): Promise<LocalUser | null> {
    return this.users.findOneBy({ email });
  }

  findById(id: string): Promise<LocalUser | null> {
    return this.users.findOneBy({ id });
  }

  save(user: LocalUser): Promise<LocalUser> {
    return this.users.save(user);
  }
}

/** All the stores an `OAuthServer` needs, on a TypeORM DataSource */
export function typeormStores(source: Source) {
  return {
    keys: new TypeOrmKeyStore(source),
    clients: new TypeOrmClientStore(source),
    grants: new TypeOrmGrantStore(source),
    refreshTokens: new TypeOrmRefreshTokenStore(source),
    issuedTokens: new TypeOrmIssuedTokenStore(source),
  };
}

export function typeormUserStore(source: Source): UserStore {
  return new TypeOrmUserStore(source);
}

/**
 * Creates the package's tables. Add it to the DataSource's `migrations`, or
 * call `up` from a migration of your own. Built from the entity definitions
 * above, so it cannot drift from them.
 */
export class CreateAuthTables1760000000000 implements MigrationInterface {
  name = 'CreateAuthTables1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const { connection } = queryRunner;
    for (const entity of authEntities) {
      // Table.create carries the entity's indices along with its columns
      await queryRunner.createTable(
        Table.create(connection.getMetadata(entity), connection.driver),
        true,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const entity of [...authEntities].reverse()) {
      await queryRunner.dropTable(
        queryRunner.connection.getMetadata(entity).tableName,
        true,
      );
    }
  }
}
