// Taico.ts - API client wrapper using generated services
import {
  OpenAPI,
  ApiError,
  AgentService,
  TaskService,
  MetaProjectsService,
  AgentRunService,
  type AgentResponseDto,
  type AgentRunResponseDto,
  type ProjectResponseDto,
  type TaskResponseDto,
} from "@taico/client";

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export class Taico {
  constructor(
    baseUrl: string,
    accessToken: string,
  ) {
    // Configure the generated client
    OpenAPI.BASE = baseUrl;
    OpenAPI.TOKEN = accessToken;
  }

  async getAgent(agentSlug: string): Promise<AgentResponseDto | null> {
    try {
      return await AgentService.agentsControllerGetAgentBySlug(agentSlug);
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
      await TaskService.tasksControllerAddComment(taskId, { content: comment });
    } catch (error) {
      console.error(`Failed to post comment to task ${taskId}:`, error);
    }
  }

  async listTasks(page = 1, limit = 100): Promise<TaskResponseDto[]> {
    const response = await TaskService.tasksControllerListTasks(
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
      return await TaskService.tasksControllerGetTask(taskId);
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getProjectBySlug(slug: string): Promise<ProjectResponseDto | null> {
    try {
      return await MetaProjectsService.projectsControllerGetProjectBySlug(slug);
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async startRun(taskId: string): Promise<AgentRunResponseDto | null> {
    try {
      return await AgentRunService.agentRunsControllerCreateAgentRun({
        parentTaskId: taskId,
      });
    } catch (error) {
      console.error(`Failed to start run for task ${taskId}:`, error);
      return null;
    }
  }
}
