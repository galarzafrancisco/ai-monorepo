import {
  DEFAULT_WORKER_CREDENTIALS_PATH,
  readWorkerCredentials,
  writeWorkerCredentials,
} from './credentials-store';
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

  if (!credentials || credentials.serverUrl !== input.serverUrl) {
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
