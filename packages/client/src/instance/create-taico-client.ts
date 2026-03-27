import type { OpenAPIConfig } from '../client/core/OpenAPI.js';
import { request } from '../client/core/request.js';
import type { AgentListResponseDto } from '../client/models/AgentListResponseDto.js';
import type { AgentResponseDto } from '../client/models/AgentResponseDto.js';
import type { CommentResponseDto } from '../client/models/CommentResponseDto.js';
import type { CreateCommentDto } from '../client/models/CreateCommentDto.js';
import type { CreateTaskDto } from '../client/models/CreateTaskDto.js';
import type { TaskResponseDto } from '../client/models/TaskResponseDto.js';

export type TaicoClientConfig = {
  baseUrl: string;
  token?: string;
};

export type TaicoClient = {
  agents: AgentsApi;
  tasks: TasksApi;
};

type RequestAgentExecutionTokenDto = {
  scopes: string[];
  expirationSeconds?: number;
};

type AgentExecutionTokenResponseDto = {
  token: string;
  scopes: string[];
  expiresAt: string;
  agentSlug: string;
  requestedByClientId: string;
};

export function createTaicoClient(config: TaicoClientConfig): TaicoClient {
  const clientConfig = createOpenApiConfig(config);

  return {
    agents: new AgentsApi(clientConfig),
    tasks: new TasksApi(clientConfig),
  };
}

class AgentsApi {
  constructor(private readonly config: OpenAPIConfig) {}

  async list(input?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<AgentListResponseDto> {
    return request<AgentListResponseDto>(this.config, {
      method: 'GET',
      url: '/api/v1/agents',
      query: {
        isActive: input?.isActive,
        page: input?.page ?? 1,
        limit: input?.limit ?? 20,
      },
    });
  }

  async getBySlug(slug: string): Promise<AgentResponseDto> {
    return request<AgentResponseDto>(this.config, {
      method: 'GET',
      url: '/api/v1/agents/{slug}',
      path: {
        slug,
      },
    });
  }

  async requestExecutionToken(
    slug: string,
    requestBody: RequestAgentExecutionTokenDto,
  ): Promise<AgentExecutionTokenResponseDto> {
    return request<AgentExecutionTokenResponseDto>(this.config, {
      method: 'POST',
      url: '/api/v1/agents/{slug}/execution-token',
      path: {
        slug,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
}

class TasksApi {
  constructor(private readonly config: OpenAPIConfig) {}

  async create(requestBody: CreateTaskDto): Promise<TaskResponseDto> {
    return request<TaskResponseDto>(this.config, {
      method: 'POST',
      url: '/api/v1/tasks/tasks',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: 'Invalid input data',
      },
    });
  }

  async addComment(
    taskId: string,
    requestBody: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return request<CommentResponseDto>(this.config, {
      method: 'POST',
      url: '/api/v1/tasks/tasks/{id}/comments',
      path: {
        id: taskId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: 'Invalid input data',
        404: 'Task not found',
      },
    });
  }
}

function createOpenApiConfig(config: TaicoClientConfig): OpenAPIConfig {
  return {
    BASE: normalizeBaseUrl(config.baseUrl),
    VERSION: '1.0',
    WITH_CREDENTIALS: false,
    CREDENTIALS: 'include',
    TOKEN: config.token,
    USERNAME: undefined,
    PASSWORD: undefined,
    HEADERS: undefined,
    ENCODE_PATH: undefined,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}
