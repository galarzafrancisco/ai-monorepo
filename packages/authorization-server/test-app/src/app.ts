import express from 'express';
import { createAuthorizationServer, type Principal } from '@taico/authorization-server';
import { sqliteStorage } from '@taico/authorization-server/storage/sqlite';

export async function createTestApp() {
  const app = express();
  const auth = await createAuthorizationServer({
    issuer: 'http://localhost:3000',
    storage: await sqliteStorage({ file: ':memory:' }),
    identityProvider: {
      async authenticatePassword({ email, username, password }): Promise<Principal | null> {
        if (password !== 'secret') return null;
        return { id: email ?? username ?? 'test-user', email, displayName: 'Test User' };
      },
      async findPrincipalById(id): Promise<Principal> {
        return { id };
      },
    },
    scopes: [
      { id: 'profile:read', description: 'Read profile' },
      { id: 'mcp:use', description: 'Use MCP servers' },
    ],
    screens: {
      login: { mode: 'default' },
      consent: { mode: 'default', allowSwitchAccount: true },
    },
  });

  await auth.registerMcpServer({
    id: 'tasks',
    name: 'Tasks',
    version: '1.0.0',
    resource: 'http://localhost:3000/api/tasks/mcp',
    scopes: ['mcp:use'],
    requiredScopes: ['mcp:use'],
  });

  app.use(auth.express().routes());
  app.get('/api/me', auth.express().authenticate(), auth.express().requireScopes('profile:read'), (req, res) => {
    res.json({ principal: req.auth?.principal });
  });

  return app;
}
