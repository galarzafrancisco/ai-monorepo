import {
  DEFAULT_WORKER_CREDENTIALS_PATH,
  readWorkerCredentials,
  writeWorkerCredentials,
} from './credentials-store';
import { INTERNAL_WORKER_AUTH_SCOPES } from '../../auth/core/constants/internal-auth-target.constant';
import {
  bootstrapWorkerAuthorization,
  discoverAuthorizationServer,
  refreshWorkerToken,
} from './oauth-client';
import type { WorkerCredentials } from './worker-auth.types';

export async function getAuthenticatedWorkerSession(input: {
  serverUrl: string;
  credentialsPath?: string;
}): Promise<{
  credentials: WorkerCredentials;
  credentialsPath: string;
  didBootstrap: boolean;
}> {
  const credentialsPath =
    input.credentialsPath ?? DEFAULT_WORKER_CREDENTIALS_PATH;
  const metadata = await discoverAuthorizationServer(input.serverUrl);
  let credentials = await readWorkerCredentials(credentialsPath);
  let didBootstrap = false;
  const requiredScopes = new Set(
    INTERNAL_WORKER_AUTH_SCOPES.map((scope) => scope.id),
  );

  if (
    !credentials ||
    credentials.serverUrl !== input.serverUrl ||
    !hasRequiredScopes(credentials, requiredScopes)
  ) {
    credentials = await bootstrapWorkerAuthorization(input.serverUrl, metadata);
    await writeWorkerCredentials(credentialsPath, credentials);
    didBootstrap = true;
  }

  credentials = await refreshWorkerToken(credentials);
  await writeWorkerCredentials(credentialsPath, credentials);

  return {
    credentials,
    credentialsPath,
    didBootstrap,
  };
}

function hasRequiredScopes(
  credentials: WorkerCredentials,
  requiredScopes: Set<string>,
): boolean {
  const grantedScopes = new Set(
    credentials.scope
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  );

  return Array.from(requiredScopes).every((scope) => grantedScopes.has(scope));
}
