import { ApiClient } from '@taico/client/v2';
import { AgentToolPermissionResponseDto, ServerResponseDto } from '@taico/client/v2';
import { deriveAllowedToolsFromProvidedIds } from '@taico/shared';
import { prepareWorkspace } from './helpers/prepareWorkspace.js';
import { EXECUTION_ID_HEADER } from './helpers/config.js';
import { BaseAgentRunner } from './runners/BaseAgentRunner.js';
import { AgentModelConfig, RuntimeMcpServerConfig } from './runners/AgentRunner.js';
import { ClaudeAgentRunner } from './runners/ClaudeAgentRunner.js';
import { OpencodeAgentRunner } from './runners/OpenCodeAgentRunner.js';
import { ADKAgentRunner } from './runners/ADKAgentRunner.js';
import { GitHubCopilotAgentRunner } from './runners/GitHubCopilotAgentRunner.js';
import { buildPrompt } from './prompt.js';
import { InputRequestLike, RunMode } from './types.js';
import { ExecutionActivityGatewayClient } from './execution-activity-gateway-client.js';
import {
  TaskExecutionPreconditionError,
  UnsupportedAgentTypeError,
  classifyAgentError,
  classifyRunnerError,
} from './task-execution-errors.js';

type ExecuteTaskParams = {
  taskId: string;
  executionId: string;
  workerClient: ApiClient;
  baseDir: string;
  baseUrl: string;
  activityGatewayClient: ExecutionActivityGatewayClient;
  mode?: RunMode;
  inputRequest?: InputRequestLike;
}

export async function executeTask({
  taskId,
  executionId,
  workerClient,
  baseDir,
  baseUrl,
  activityGatewayClient,
  mode = 'normal',
  inputRequest,
}: ExecuteTaskParams): Promise<void> {
  console.log(`[worker] Starting execution ${executionId} for task ${taskId}.`);

  // Get the task
  const task = await workerClient.task.TasksController_getTask({ id: taskId });
  // TODO: We should validate dependencies are clear

  // Get the agent assigned to the task
  const actor = task.assigneeActor;
  if (!actor?.slug) {
    throw new TaskExecutionPreconditionError(
      `Task ${task.id} is not assigned or is missing an assignee slug.`,
    );
  }
  const agent = await workerClient.agent.AgentsController_getAgentBySlug({ slug: actor.slug });
  if (!agent) {
    throw new TaskExecutionPreconditionError(
      `Assigned agent @${actor.slug} was not found for task ${task.id}.`,
    );
  }

  // See if the task needs a repo cloned
  let repoUrl: string | undefined = undefined;
  const projectTag = task.tags?.find((tag) => tag.name.startsWith('project:'));
  if (projectTag) {
    const projectSlug = projectTag.name.replace('project:', '');
    const project = await workerClient.metaProjects.ProjectsController_getProjectBySlug({ slug: projectSlug });
    if (project) {
      repoUrl = project.repoUrl;
    }
  }

  // Prepare the workspace
  const workDir = await prepareWorkspace({
    taskId,
    agentId: agent.actorId,
    baseDir,
    repoUrl: repoUrl,
  });

  const thread = await workerClient.threads.ThreadsController_getThreadByTaskId({ taskId });

  const permissions =
    await workerClient.agent.AgentToolPermissionsController_listAgentToolPermissions({
      actorId: agent.actorId,
    });
  const serversById = await fetchMcpServersById(workerClient, permissions);
  const runtimeMcpServers = buildRuntimeMcpServers(
    permissions,
    serversById,
    executionId,
  );
  const allowedTools = deriveAllowedToolsFromProvidedIds(
    Object.keys(runtimeMcpServers),
  );

  // Get an access token for the agent
  const agentToken = await workerClient.agentExecutionTokens.AgentExecutionTokensController_requestExecutionToken({
    slug: agent.slug,
    body: {
      expirationSeconds: 60 * 60, // 1 hour? what's a sensible ttl?
    }
  });

  attachRuntimeAuthHeaders(runtimeMcpServers, agentToken.token);

  // Create runner
  let runner: BaseAgentRunner | null = null;
  const modelConfig: AgentModelConfig = {
    providerId: agent.providerId ?? undefined,
    modelId: agent.modelId ?? undefined,
  };
  if (agent.type === 'claude') {
    runner = new ClaudeAgentRunner(modelConfig);
  } else if (agent.type === 'opencode') {
    runner = new OpencodeAgentRunner(modelConfig);
  } else if (agent.type === 'adk') {
    runner = new ADKAgentRunner(modelConfig);
  } else if (agent.type === 'githubcopilot') {
    runner = new GitHubCopilotAgentRunner(modelConfig);
  }

  if (!runner) {
    throw new UnsupportedAgentTypeError(
      `Agent type "${agent.type}" is not supported by this worker.`,
    );
  }

  // Run and pipe results
  try {
    let latestRunnerSessionId: string | null = null;
    await runner.run(
      {
        taskId,
        prompt: buildPrompt(task, agent, mode, inputRequest, thread),
        cwd: workDir,
        baseUrl,
        accessToken: agentToken.token,
        executionId,
        resume: undefined,
        agentSlug: agent.slug,
        mcpServers: runtimeMcpServers,
        allowedTools,
      },
      {
        onHeartbeat: async () => {
          await activityGatewayClient.publishHeartbeat({ executionId });
        },
        onEvent: async (message: string) => {
          console.log(`[agent message] ⤵️`);
          console.log(message);
          console.log('[end of agent message] ⤴️');
          await activityGatewayClient.publishActivity({
            executionId,
            message,
            ts: Date.now(),
            runnerSessionId: latestRunnerSessionId,
          });
        },
        onSession: (runnerSessionId: string) => {
          latestRunnerSessionId = runnerSessionId;
          return workerClient.executionsV2
            .ActiveTaskExecutionController_updateRunnerSessionId({
              executionId,
              body: {
                sessionId: runnerSessionId,
              },
            })
            .catch((error) => {
              console.warn(
                `[worker] failed to persist runner session id for execution ${executionId}: ${error instanceof Error ? error.message : String(error)}`,
              );
            });
        },
        onToolCall: (toolName: string) => {
          return workerClient.executionsV2
            .ActiveTaskExecutionController_incrementToolCallCount({
              executionId,
            })
            .catch((error) => {
              console.warn(
                `[worker] failed to increment tool call count for execution ${executionId} (tool=${toolName}): ${error instanceof Error ? error.message : String(error)}`,
              );
            });
        },
        onError: (error: { message: string; rawMessage?: any }) => {
          console.log('Error detected');
          console.log('error message:', error.message);
          console.log('raw message', error.rawMessage);
          throw classifyAgentError(error);
        }
      }
    );
  } catch (error) {
    throw classifyRunnerError(error);
  }
}

function buildRuntimeMcpServers(
  permissions: AgentToolPermissionResponseDto[],
  serversById: Map<string, ServerResponseDto>,
  executionId: string,
): Record<string, RuntimeMcpServerConfig> {
  const mcpServers: Record<string, RuntimeMcpServerConfig> = {};

  for (const permission of permissions) {
    const providedId = permission.server.providedId;
    const server = serversById.get(permission.server.id);
    if (!server) {
      continue;
    }

    if (server.type === 'http' && server.url) {
      mcpServers[providedId] = {
        type: 'http',
        url: server.url,
        headers: {
          [EXECUTION_ID_HEADER]: executionId,
        },
      };
      continue;
    }

    if (server.type === 'stdio' && server.cmd) {
      mcpServers[providedId] = {
        type: 'stdio',
        command: server.cmd,
        args: server.args ?? [],
      };
    }
  }

  return mcpServers;
}

async function fetchMcpServersById(
  workerClient: ApiClient,
  permissions: AgentToolPermissionResponseDto[],
): Promise<Map<string, ServerResponseDto>> {
  const serverIds = Array.from(
    new Set(permissions.map((permission) => permission.server.id)),
  );
  const servers = await Promise.all(
    serverIds.map((serverId) =>
      workerClient.tools.McpRegistryController_getServer({ serverId }),
    ),
  );
  return new Map(servers.map((server) => [server.id, server]));
}

function attachRuntimeAuthHeaders(
  mcpServers: Record<string, RuntimeMcpServerConfig>,
  accessToken: string,
): void {
  for (const server of Object.values(mcpServers)) {
    if (server.type !== 'http') {
      continue;
    }

    server.headers = {
      ...server.headers,
      Authorization: `Bearer ${accessToken}`,
    };
  }
}
