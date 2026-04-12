import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateTaskBlueprintDto, TaskBlueprintListResponseDto, TaskBlueprintResponseDto, TaskResponseDto, UpdateTaskBlueprintDto } from './types.js';

export class TaskBlueprintsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new task blueprint */
  async TaskBlueprintsController_createTaskBlueprint(params: { body: CreateTaskBlueprintDto; signal?: AbortSignal }): Promise<TaskBlueprintResponseDto> {
    return this.request('POST', '/api/v1/task-blueprints', { body: params.body, signal: params?.signal });
  }

  /** List all task blueprints */
  async TaskBlueprintsController_listTaskBlueprints(params?: { page?: number; limit?: number; signal?: AbortSignal }): Promise<TaskBlueprintListResponseDto> {
    return this.request('GET', '/api/v1/task-blueprints', { params: { page: params?.page, limit: params?.limit }, signal: params?.signal });
  }

  /** Get a task blueprint by ID */
  async TaskBlueprintsController_getTaskBlueprint(params: { id: string; signal?: AbortSignal }): Promise<TaskBlueprintResponseDto> {
    return this.request('GET', `/api/v1/task-blueprints/${params.id}`, { signal: params?.signal });
  }

  /** Update a task blueprint */
  async TaskBlueprintsController_updateTaskBlueprint(params: { id: string; body: UpdateTaskBlueprintDto; signal?: AbortSignal }): Promise<TaskBlueprintResponseDto> {
    return this.request('PATCH', `/api/v1/task-blueprints/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Delete a task blueprint */
  async TaskBlueprintsController_deleteTaskBlueprint(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/task-blueprints/${params.id}`, { responseType: 'void', signal: params?.signal });
  }

  /** Create a task from a blueprint */
  async TaskBlueprintsController_createTaskFromBlueprint(params: { id: string; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('POST', `/api/v1/task-blueprints/${params.id}/create-task`, { signal: params?.signal });
  }

}