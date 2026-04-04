import { ApiClient } from '@taico/client/v2';
import { setTimeout as sleep } from 'timers/promises';
import { prepareWorkspace } from './helpers/prepareWorkspace.js';

const SIMULATED_WORK_DURATION_MS = 5_000;

type ExecuteTaskParams = {
  taskId: string;
  executionId: string;
  workerClient: ApiClient;
  baseDir: string;
}

export async function executeTask({ taskId, executionId, workerClient, baseDir }: ExecuteTaskParams): Promise<void> {
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
  await prepareWorkspace({
    taskId,
    agentId: agent.actorId,
    baseDir,
    repoUrl: repoUrl,
  });

  // NOTE: the old worker has the concept of a run id. We don't have that here yet. Do we need it?
  
  // Create runner

  // Pipe results

  await sleep(SIMULATED_WORK_DURATION_MS);
}
