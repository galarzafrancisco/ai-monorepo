import sqlite3 from 'sqlite3';
import type { JWK } from 'jose';

import type { AuthorizationClient, AuthorizationCode, AuthorizationStorage, StoredAuthorizationInteraction } from '../types.js';

export type SqliteStorageOptions = { file: string };

export async function sqliteStorage(options: SqliteStorageOptions): Promise<AuthorizationStorage> {
  const db = new sqlite3.Database(options.file);
  const run = (sql: string, params: unknown[] = []) => new Promise<void>((resolve, reject) => db.run(sql, params, (error) => error ? reject(error) : resolve()));
  const runWithChanges = (sql: string, params: unknown[] = []) => new Promise<number>((resolve, reject) => db.run(sql, params, function (error) { return error ? reject(error) : resolve(this.changes); }));
  const get = <T>(sql: string, params: unknown[] = []) => new Promise<T | undefined>((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row as T | undefined)));
  const all = <T>(sql: string, params: unknown[] = []) => new Promise<T[]>((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows as T[])));

  await run('PRAGMA journal_mode = WAL');
  await run('CREATE TABLE IF NOT EXISTS auth_clients (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_used_at TEXT)');
  await run('CREATE TABLE IF NOT EXISTS auth_codes (code TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT)');
  await run('CREATE TABLE IF NOT EXISTS auth_interactions (flow_id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL)');
  await run('CREATE TABLE IF NOT EXISTS auth_grants (id TEXT PRIMARY KEY, subject TEXT NOT NULL, client_id TEXT NOT NULL, audience TEXT, scopes TEXT NOT NULL, created_at TEXT NOT NULL)');
  await run('CREATE TABLE IF NOT EXISTS auth_signing_keys (kid TEXT PRIMARY KEY, data TEXT NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL)');

  return {
    async saveClient(client) {
      await run('INSERT INTO auth_clients (id, data, created_at, updated_at, last_used_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, last_used_at = excluded.last_used_at', [client.id, JSON.stringify(client), client.createdAt, client.updatedAt, client.lastUsedAt ?? null]);
    },
    async getClient(id) {
      const row = await get<{ data: string }>('SELECT data FROM auth_clients WHERE id = ?', [id]);
      return row ? JSON.parse(row.data) as AuthorizationClient : null;
    },
    async touchClient(id) {
      await run('UPDATE auth_clients SET last_used_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    },
    async saveAuthorizationCode(code) {
      await run('INSERT INTO auth_codes (code, data, expires_at, used_at) VALUES (?, ?, ?, NULL)', [code.code, JSON.stringify(code), code.expiresAt]);
    },
    async consumeAuthorizationCode(codeValue) {
      const now = new Date().toISOString();
      const changes = await runWithChanges('UPDATE auth_codes SET used_at = ? WHERE code = ? AND used_at IS NULL AND expires_at >= ?', [now, codeValue, now]);
      if (changes !== 1) return null;
      const row = await get<{ data: string }>('SELECT data FROM auth_codes WHERE code = ?', [codeValue]);
      if (!row) return null;
      return JSON.parse(row.data) as AuthorizationCode;
    },
    async saveInteraction(interaction) {
      await run('INSERT INTO auth_interactions (flow_id, data, expires_at) VALUES (?, ?, ?) ON CONFLICT(flow_id) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at', [interaction.flowId, JSON.stringify(interaction), interaction.expiresAt]);
    },
    async getInteraction(flowId) {
      const row = await get<{ data: string; expires_at: string }>('SELECT data, expires_at FROM auth_interactions WHERE flow_id = ?', [flowId]);
      if (!row || Date.parse(row.expires_at) < Date.now()) return null;
      return JSON.parse(row.data) as StoredAuthorizationInteraction;
    },
    async deleteInteraction(flowId) {
      await run('DELETE FROM auth_interactions WHERE flow_id = ?', [flowId]);
    },
    async rememberGrant(input) {
      const id = `${input.subject}:${input.clientId}:${input.audience ?? ''}:${[...input.scopes].sort().join(' ')}`;
      await run('INSERT OR IGNORE INTO auth_grants (id, subject, client_id, audience, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, input.subject, input.clientId, input.audience ?? null, [...input.scopes].sort().join(' '), new Date().toISOString()]);
    },
    async hasGrant(input) {
      const requested = [...input.scopes].sort().join(' ');
      const rows = await all<{ scopes: string }>('SELECT scopes FROM auth_grants WHERE subject = ? AND client_id = ? AND coalesce(audience, \'\') = ?', [input.subject, input.clientId, input.audience ?? '']);
      return rows.some((row) => requested.split(' ').every((scope) => row.scopes.split(' ').includes(scope)));
    },
    async saveSigningKey(key) {
      await run('UPDATE auth_signing_keys SET active = 0');
      await run('INSERT INTO auth_signing_keys (kid, data, active, created_at) VALUES (?, ?, 1, ?)', [key.kid, JSON.stringify(key), new Date().toISOString()]);
    },
    async getActiveSigningKey() {
      const row = await get<{ data: string }>('SELECT data FROM auth_signing_keys WHERE active = 1 ORDER BY created_at DESC LIMIT 1');
      return row ? JSON.parse(row.data) as JWK : null;
    },
    async listPublicSigningKeys() {
      const rows = await all<{ data: string }>('SELECT data FROM auth_signing_keys ORDER BY created_at DESC');
      return rows.map((row) => {
        const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, ...publicKey } = JSON.parse(row.data) as JWK;
        return publicKey;
      });
    },
  };
}
