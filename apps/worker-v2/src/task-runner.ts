import { ApiClient } from '@taico/client/v2';
import { setTimeout as sleep } from 'timers/promises';
import { DEFAULT_AGENT_TOKEN_SCOPES } from '@taico/shared';
import { prepareWorkspace } from './helpers/prepareWorkspace.js';
import { BaseAgentRunner } from './runners/BaseAgentRunner.js';
import { AgentModelConfig } from './runners/AgentRunner.js';
import { ClaudeAgentRunner } from './runners/ClaudeAgentRunner.js';
import { OpencodeAgentRunner } from './runners/OpenCodeAgentRunner.js';
import { ADKAgentRunner } from './runners/ADKAgentRunner.js';
import { GitHubCopilotAgentRunner } from './runners/GitHubCopilotAgentRunner.js';
import { buildPrompt } from './prompt.js';
import { InputRequestLike, RunMode } from './types.js';
import { ExecutionActivityGatewayClient } from './execution-activity-gateway-client.js';

const SIMULATED_WORK_DURATION_MS = 5_000;

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
  console.log(
    `[worker] Placeholder run for task ${taskId} (execution ${executionId}). Simulating work for ${SIMULATED_WORK_DURATION_MS / 1000}s.`,
  );

  // Get the task
  const task = await workerClient.task.TasksController_getTask({ id: taskId });
  // TODO: We should validate dependencies are clear

  // Get the agent assigned to the task
  const actor = task.assigneeActor;
  if (!actor?.slug) {
    // This should be an error really. If a task made it to the queue, it should be assigned.
    // Unless it got unassigned in the time it took us to pick it up.
    // Think about how we want to hanlde this. Should we cancel the execution?
    console.log(`- Task ${task.id} not assigned or missing actor slug.`);
    return;
  }
  const agent = await workerClient.agent.AgentsController_getAgentBySlug({ slug: actor.slug });
  // TODO: what happens if the agent doesn't exist for whatever reason?

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

  // Get an access token for the agent
  const agentToken = await workerClient.agentExecutionTokens.AgentExecutionTokensController_requestExecutionToken({
    slug: agent.slug,
    body: {
      scopes: [...DEFAULT_AGENT_TOKEN_SCOPES],
      expirationSeconds: 60 * 60, // 1 hour? what's a sensible ttl?
    }
  });

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
    // Type of runner we don't support yet. We need to release the task.
    // What should we return?
    return;
  }

  // Run and pipe results
  try {
    let latestRunnerSessionId: string | null = null;
    const results = await runner.run(
      {
        taskId,
        prompt: buildPrompt(task, agent, mode, inputRequest, thread),
        cwd: workDir,
        baseUrl,
        accessToken: agentToken.token,
        executionId,
        resume: undefined,
        agentSlug: agent.slug,
      },
      {
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
        },
        onError: (error: { message: string; rawMessage?: any }) => {
          console.log('Error detected');
          console.log('error message:', error.message);
          console.log('raw message', error.rawMessage);
          // TODO: The agent returned a message that is an error. What do we do?
        }
      }
    );
  } catch (error) {
    // TODO: Something went wrong with the runner in a way we didn't expect
    // Should restore the task?
  } finally {

  }

  await sleep(SIMULATED_WORK_DURATION_MS);
}
