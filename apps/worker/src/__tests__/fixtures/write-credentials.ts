// Run as its own process by credentialsStore.test.ts: writes one workspace's
// credentials to the shared file, like a separate worker would.
import { writeWorkerCredentials } from '../../auth/credentials-store.js';

const [path, workspace] = process.argv.slice(2);
await writeWorkerCredentials(path, {
  serverUrl: 'http://localhost:2008',
  clientId: workspace,
  redirectUri: 'http://127.0.0.1:1/callback',
  scope: 'workers:connect',
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: new Date(0).toISOString(),
  workspace,
});
