import { exportJWK, generateKeyPair, importJWK } from 'jose';
import * as sqlite3 from 'sqlite3';
import type {
  AuthorizationInteraction,
  AuthorizationStorage,
  ClientDefinition,
  DownstreamConnectionDefinition,
  KeyStore,
} from '../types.js';

type Sqlite3Module = typeof import('sqlite3');

const sqlite3Module =
  (sqlite3 as unknown as { default?: Sqlite3Module }).default ?? (sqlite3 as unknown as Sqlite3Module);

export type SqliteAuthorizationStorageOptions = {
  file?: string;
  filename?: string;
};

export type SqliteAuthorizationStorage = AuthorizationStorage & {
  flush(): Promise<void>;
  close(): Promise<void>;
};

type StoredRow = {
  item_key: string;
  item_json: string;
};

type SigningKeyRow = {
  kid: string;
  private_jwk_json: string;
  public_jwk_json: string;
};

type PersistableAuthValue =
  | ClientDefinition
  | AuthorizationInteraction
  | unknown
  | DownstreamConnectionDefinition;

export async function sqliteStorage(options: SqliteAuthorizationStorageOptions = {}): Promise<SqliteAuthorizationStorage> {
  const db = openDatabase(options);
  const database = new SqliteDatabase(db);
  await initializeStorage(database);

  const clients = await PersistentJsonMap.create<ClientDefinition>(database, 'clients');
  const interactions = await PersistentJsonMap.create<AuthorizationInteraction>(database, 'interactions');
  const grants = await PersistentJsonMap.create<unknown>(database, 'grants');
  const downstreamConnections = await PersistentJsonMap.create<DownstreamConnectionDefinition>(database, 'downstreamConnections');

  const storage: SqliteAuthorizationStorage = {
    clients,
    interactions,
    grants,
    downstreamConnections,
    async flush() {
      await Promise.all([clients.flush(), interactions.flush(), grants.flush(), downstreamConnections.flush()]);
    },
    async close() {
      await storage.flush();
      await database.close();
    },
  };
  return storage;
}

export async function sqliteKeyStore(options: SqliteAuthorizationStorageOptions = {}): Promise<KeyStore & { close(): Promise<void> }> {
  const db = openDatabase(options);
  const database = new SqliteDatabase(db);
  await initializeKeyStore(database);

  let activeKid: string = (await getActiveKid(database)) ?? (await insertGeneratedKey(database, 1));

  return {
    async getActiveSigningKey() {
      const row = await getSigningKey(database, activeKid);
      return importJWK(JSON.parse(row.private_jwk_json), 'RS256') as Promise<CryptoKey>;
    },
    async getActiveKeyId() {
      return activeKid;
    },
    async getVerificationKey(kid?: string) {
      const row = await getSigningKey(database, kid ?? activeKid);
      return importJWK(JSON.parse(row.public_jwk_json), 'RS256') as Promise<CryptoKey>;
    },
    async listPublicKeys() {
      const rows = await database.all<SigningKeyRow>(
        'SELECT kid, public_jwk_json FROM authorization_server_signing_keys ORDER BY created_at DESC',
      );
      return rows.map((row) => ({ ...JSON.parse(row.public_jwk_json), kid: row.kid, alg: 'RS256', use: 'sig' }));
    },
    async rotate() {
      const nextVersion = Number(activeKid.split('-').at(-1) ?? '0') + 1;
      activeKid = await insertGeneratedKey(database, nextVersion);
    },
    async close() {
      await database.close();
    },
  };
}

class PersistentJsonMap<T extends PersistableAuthValue> extends Map<string, T> {
  private pending: Promise<void> = Promise.resolve();

  private constructor(
    private readonly database: SqliteDatabase,
    private readonly storeName: string,
    entries: Array<[string, T]>,
  ) {
    super();
    for (const [key, value] of entries) {
      super.set(key, value);
    }
  }

  static async create<T extends PersistableAuthValue>(database: SqliteDatabase, storeName: string) {
    const rows = await database.all<StoredRow>(
      'SELECT item_key, item_json FROM authorization_server_storage WHERE store_name = ?',
      [storeName],
    );
    return new PersistentJsonMap<T>(
      database,
      storeName,
      rows.map((row) => [row.item_key, JSON.parse(row.item_json) as T]),
    );
  }

  override set(key: string, value: T): this {
    super.set(key, value);
    this.enqueue(
      'INSERT OR REPLACE INTO authorization_server_storage (store_name, item_key, item_json, updated_at) VALUES (?, ?, ?, ?)',
      [this.storeName, key, JSON.stringify(value), Date.now()],
    );
    return this;
  }

  override delete(key: string): boolean {
    const deleted = super.delete(key);
    if (deleted) {
      this.enqueue('DELETE FROM authorization_server_storage WHERE store_name = ? AND item_key = ?', [this.storeName, key]);
    }
    return deleted;
  }

  override clear(): void {
    super.clear();
    this.enqueue('DELETE FROM authorization_server_storage WHERE store_name = ?', [this.storeName]);
  }

  async flush(): Promise<void> {
    await this.pending;
  }

  private enqueue(sql: string, params: unknown[] = []) {
    this.pending = this.pending.then(() => this.database.run(sql, params));
  }
}

class SqliteDatabase {
  constructor(private readonly db: sqlite3.Database) {}

  run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row: T | undefined) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(row);
      });
    });
  }

  all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows: T[]) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

function openDatabase(options: SqliteAuthorizationStorageOptions) {
  return new sqlite3Module.Database(options.file ?? options.filename ?? ':memory:');
}

async function initializeStorage(database: SqliteDatabase) {
  await database.run('PRAGMA foreign_keys = ON');
  await database.run(
    `CREATE TABLE IF NOT EXISTS authorization_server_storage (
      store_name TEXT NOT NULL,
      item_key TEXT NOT NULL,
      item_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (store_name, item_key)
    )`,
  );
}

async function initializeKeyStore(database: SqliteDatabase) {
  await database.run(
    `CREATE TABLE IF NOT EXISTS authorization_server_signing_keys (
      kid TEXT PRIMARY KEY,
      private_jwk_json TEXT NOT NULL,
      public_jwk_json TEXT NOT NULL,
      active INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  );
}

async function getActiveKid(database: SqliteDatabase) {
  const row = await database.get<{ kid: string }>(
    'SELECT kid FROM authorization_server_signing_keys WHERE active = 1 ORDER BY created_at DESC LIMIT 1',
  );
  return row?.kid;
}

async function getSigningKey(database: SqliteDatabase, kid: string) {
  const row = await database.get<SigningKeyRow>(
    'SELECT kid, private_jwk_json, public_jwk_json FROM authorization_server_signing_keys WHERE kid = ?',
    [kid],
  );
  if (!row) {
    throw new Error(`Signing key not found: ${kid}`);
  }
  return row;
}

async function insertGeneratedKey(database: SqliteDatabase, version: number) {
  const kid = `sqlite-${version}`;
  const pair = await generateKeyPair('RS256', { extractable: true });
  const privateJwk = await exportJWK(pair.privateKey);
  const publicJwk = await exportJWK(pair.publicKey);

  await database.run('UPDATE authorization_server_signing_keys SET active = 0');
  await database.run(
    'INSERT INTO authorization_server_signing_keys (kid, private_jwk_json, public_jwk_json, active, created_at) VALUES (?, ?, ?, 1, ?)',
    [kid, JSON.stringify(privateJwk), JSON.stringify(publicJwk), Date.now()],
  );
  return kid;
}
