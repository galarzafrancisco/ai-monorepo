import { getAuthenticatedWorkerSession } from './auth/worker-auth-client';

type WorkerModeOptions = {
  serverUrl: string;
  credentialsPath?: string;
};

type AgentSummary = {
  actorId: string;
  slug: string;
  name: string;
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

  const agents = await listAgents(serverUrl, session.credentials.accessToken);
  console.log(`[worker] Loaded ${agents.length} agent(s)`);

  if (agents.length === 0) {
    console.log('[worker] No agents available. Stopping after auth smoke test.');
    return;
  }

  const agent = agents[0];
  console.log(`[worker] Requesting execution token for @${agent.slug}`);
  const executionToken = await requestAgentExecutionToken(
    serverUrl,
    session.credentials.accessToken,
    agent.slug,
  );

  const createdTask = await createSmokeTask(
    serverUrl,
    executionToken.token,
    agent.actorId,
  );

  console.log(
    `[worker] Smoke task created as @${agent.slug}: ${createdTask.id} "${createdTask.name}"`,
  );
}

async function listAgents(
  serverUrl: string,
  accessToken: string,
): Promise<AgentSummary[]> {
  const response = await fetch(`${serverUrl}/api/v1/agents`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to list agents: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    items: Array<{ actorId: string; slug: string; name: string }>;
  };

  return payload.items;
}

async function requestAgentExecutionToken(
  serverUrl: string,
  accessToken: string,
  agentSlug: string,
): Promise<{ token: string }> {
  const response = await fetch(
    `${serverUrl}/api/v1/agents/${agentSlug}/execution-token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scopes: ['tasks:read', 'tasks:write'],
        expirationSeconds: 600,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to request execution token: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<{ token: string }>;
}

async function createSmokeTask(
  serverUrl: string,
  accessToken: string,
  assigneeActorId: string,
): Promise<{ id: string; name: string }> {
  const response = await fetch(`${serverUrl}/api/v1/tasks/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Worker auth smoke test ${new Date().toISOString()}`,
      description:
        'Created by taico worker-mode OAuth smoke test to verify agent execution token flow.',
      assigneeActorId,
      tagNames: ['system:worker-auth-smoke'],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create smoke task: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<{ id: string; name: string }>;
}

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}
