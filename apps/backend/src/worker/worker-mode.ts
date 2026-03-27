import { createTaicoClient } from '@taico/client';
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

  const workerApi = createTaicoClient({
    baseUrl: serverUrl,
    token: session.credentials.accessToken,
  });

  const agents = await listAgents(workerApi);
  console.log(`[worker] Loaded ${agents.length} agent(s)`);

  if (agents.length === 0) {
    console.log('[worker] No agents available. Stopping after auth smoke test.');
    return;
  }

  if (agents.length < 2) {
    console.log(
      '[worker] Need at least 2 agents for the dual-agent smoke test. Stopping.',
    );
    return;
  }

  const [agentOne, agentTwo] = agents;
  console.log(`[worker] Requesting execution token for @${agentOne.slug}`);
  const agentOneExecution = await workerApi.agents.requestExecutionToken(
    agentOne.slug,
    {
      scopes: ['tasks:read', 'tasks:write'],
      expirationSeconds: 600,
    },
  );

  console.log(`[worker] Requesting execution token for @${agentTwo.slug}`);
  const agentTwoExecution = await workerApi.agents.requestExecutionToken(
    agentTwo.slug,
    {
      scopes: ['tasks:read', 'tasks:write'],
      expirationSeconds: 600,
    },
  );

  const agentOneClient = createTaicoClient({
    baseUrl: serverUrl,
    token: agentOneExecution.token,
  });
  const agentTwoClient = createTaicoClient({
    baseUrl: serverUrl,
    token: agentTwoExecution.token,
  });

  const createdTask = await createSmokeTask(agentOneClient, agentOne.actorId);
  console.log(
    `[worker] Smoke task created as @${agentOne.slug}: ${createdTask.id} "${createdTask.name}"`,
  );

  await addSmokeComment(agentTwoClient, createdTask.id, agentTwo.slug);
  console.log(
    `[worker] Smoke comment added as @${agentTwo.slug} to task ${createdTask.id}`,
  );
}

async function listAgents(
  taicoClient: ReturnType<typeof createTaicoClient>,
): Promise<AgentSummary[]> {
  const response = await taicoClient.agents.list({ limit: 100 });
  return response.items.map((agent) => ({
    actorId: agent.actorId,
    slug: agent.slug,
    name: agent.name,
  }));
}

async function createSmokeTask(
  taicoClient: ReturnType<typeof createTaicoClient>,
  assigneeActorId: string,
): Promise<{ id: string; name: string }> {
  const task = await taicoClient.tasks.create({
    name: `Worker auth smoke test ${new Date().toISOString()}`,
    description:
      'Created by taico worker-mode OAuth smoke test to verify agent execution token flow.',
    assigneeActorId,
    tagNames: ['system:worker-auth-smoke'],
  });

  return {
    id: task.id,
    name: task.name,
  };
}

async function addSmokeComment(
  taicoClient: ReturnType<typeof createTaicoClient>,
  taskId: string,
  agentSlug: string,
): Promise<void> {
  await taicoClient.tasks.addComment(taskId, {
    content: `Worker auth smoke test comment from @${agentSlug}.`,
  });
}

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}
