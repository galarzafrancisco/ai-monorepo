// Taico.ts - API client wrapper using generated services
import {
  ApiError,
  createTaicoClient,
  type TaicoClient,
  type AgentResponseDto,
  type AgentRunResponseDto,
  type ProjectResponseDto,
  type TaskResponseDto,
  type ThreadResponseDto,
} from "@taico/client";

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export class Taico {
  private readonly client: TaicoClient;

  constructor(
    baseUrl: string,
    accessToken: string,
  ) {
    this.client = createTaicoClient({
      baseUrl,
      token: accessToken,
    });
  }

  async getAgent(agentSlug: string): Promise<AgentResponseDto | null> {
    try {
      return await this.client.AgentService.agentsControllerGetAgentBySlug(agentSlug);
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getAgentPrompt(agentSlug: string): Promise<string> {
    const agent = await this.getAgent(agentSlug);
    const prompt = agent?.systemPrompt;

    if (typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error(
        `[Taico] Agent @${agentSlug} has no systemPrompt.`
      );
    }

    return prompt;
  }

  async getAgentStatusTriggers(agentSlug: string): Promise<string[]> {
    const agent = await this.getAgent(agentSlug);
    const triggers = agent?.statusTriggers;

    if (!Array.isArray(triggers) || triggers.some((t) => typeof t !== "string")) {
      throw new Error(
        `[Taico] Agent @${agentSlug} has invalid statusTriggers (expected string[]).`
      );
    }

    return triggers;
  }

  async addComment(taskId: string, comment: string): Promise<void> {
    try {
      await this.client.TaskService.tasksControllerAddComment(taskId, { content: comment });
    } catch (error) {
      console.error(`Failed to post comment to task ${taskId}:`, error);
    }
  }

  async listTasks(page = 1, limit = 100): Promise<TaskResponseDto[]> {
    const response = await this.client.TaskService.tasksControllerListTasks(
      undefined,
      undefined,
      undefined,
      page,
      limit,
    );
    return response.items;
  }

  async getTask(taskId: string): Promise<TaskResponseDto | null> {
    try {
      return await this.client.TaskService.tasksControllerGetTask(taskId);
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getProjectBySlug(slug: string): Promise<ProjectResponseDto | null> {
    try {
      return await this.client.MetaProjectsService.projectsControllerGetProjectBySlug(slug);
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getThreadByTaskId(taskId: string): Promise<ThreadResponseDto | null> {
    try {
      return await this.client.ThreadsService.threadsControllerGetThreadByTaskId(taskId);
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async startRun(taskId: string): Promise<AgentRunResponseDto | null> {
    try {
      return await this.client.AgentRunService.agentRunsControllerCreateAgentRun({
        parentTaskId: taskId,
      });
    } catch (error) {
      console.error(`Failed to start run for task ${taskId}:`, error);
      return null;
    }
  }
}
