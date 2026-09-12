import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DisplayAuth } from '../dist/auth.js';

test('persists display credentials with owner-only permissions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'taico-display-auth-'));
  const credentialsPath = join(directory, 'credentials', 'display-credentials.json');
  const auth = new DisplayAuth('https://taico.example', credentialsPath);

  try {
    await auth.persistCredentials({
      serverUrl: 'https://taico.example',
      clientId: 'client-id',
      redirectUri: 'http://127.0.0.1:1234/callback',
      scope: 'tasks:read',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });

    assert.equal((await stat(credentialsPath)).mode & 0o777, 0o600);
    await chmod(credentialsPath, 0o644);
    await auth.persistCredentials({
      serverUrl: 'https://taico.example',
      clientId: 'client-id',
      redirectUri: 'http://127.0.0.1:1234/callback',
      scope: 'tasks:read',
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      expiresAt: '2030-01-02T00:00:00.000Z',
    });
    assert.equal((await stat(credentialsPath)).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
