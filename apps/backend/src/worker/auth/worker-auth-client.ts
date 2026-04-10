import {
  DEFAULT_WORKER_CREDENTIALS_PATH,
  readServerCredentials,
  writeServerCredentials,
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
  let credentials = await readServerCredentials(credentialsPath, input.serverUrl);
  let didBootstrap = false;
  const requiredScopes = new Set(
    INTERNAL_WORKER_AUTH_SCOPES.map((scope) => scope.id),
  );

  if (
    !credentials ||
    !hasRequiredScopes(credentials, requiredScopes)
  ) {
    credentials = await bootstrapWorkerAuthorization(input.serverUrl, metadata);
    await writeServerCredentials(credentialsPath, input.serverUrl, credentials);
    didBootstrap = true;
  }

  credentials = await refreshWorkerToken(credentials);
  await writeServerCredentials(credentialsPath, input.serverUrl, credentials);

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
