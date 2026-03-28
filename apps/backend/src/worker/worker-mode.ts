import { getAuthenticatedWorkerSession } from './auth/worker-auth-client';
import { ExecutionOrchestrator } from './execution-orchestrator';
import { WorkerGatewayClient } from './worker-gateway-client';

type WorkerModeOptions = {
  serverUrl: string;
  credentialsPath?: string;
};

export async function runWorkerMode(options: WorkerModeOptions): Promise<void> {
  const serverUrl = normalizeBaseUrl(options.serverUrl);

  console.log(`[worker] Starting worker mode against ${serverUrl}`);

  const session = await getAuthenticatedWorkerSession({
    serverUrl,
    credentialsPath: options.credentialsPath,
  });

  if (session.didBootstrap) {
    console.log(`[worker] Stored credentials at ${session.credentialsPath}`);
  }

  console.log('[worker] Refresh succeeded');

  // Connect to workers gateway
  console.log('[worker] Connecting to workers gateway...');
  const gatewayClient = new WorkerGatewayClient({
    baseUrl: serverUrl,
    accessToken: session.credentials.accessToken,
    version: process.env.npm_package_version,
    capabilities: ['claude', 'opencode'],
    debug: true,
  });
  const orchestrator = new ExecutionOrchestrator({
    serverUrl,
    workerAccessToken: session.credentials.accessToken,
    gatewayClient,
  });
  orchestrator.bind();

  await gatewayClient.start();
  console.log('[worker] Connected to workers gateway, session:', gatewayClient.getSessionId());

  // Keep the worker running
  console.log('[worker] Worker is ready and waiting for work assignments...');

  // Wait indefinitely (in real implementation, this would be the main event loop)
  await new Promise(() => {});
}

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}
