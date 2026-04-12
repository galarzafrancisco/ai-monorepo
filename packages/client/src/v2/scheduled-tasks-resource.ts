import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateScheduledTaskDto, ScheduledTaskListResponseDto, ScheduledTaskResponseDto, UpdateScheduledTaskDto } from './types.js';

export class ScheduledTasksResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new scheduled task */
  async ScheduledTasksController_createScheduledTask(params: { body: CreateScheduledTaskDto; signal?: AbortSignal }): Promise<ScheduledTaskResponseDto> {
    return this.request('POST', '/api/v1/scheduled-tasks', { body: params.body, signal: params?.signal });
  }

  /** List all scheduled tasks */
  async ScheduledTasksController_listScheduledTasks(params?: { page?: number; limit?: number; enabled?: boolean; signal?: AbortSignal }): Promise<ScheduledTaskListResponseDto> {
    return this.request('GET', '/api/v1/scheduled-tasks', { params: { page: params?.page, limit: params?.limit, enabled: params?.enabled }, signal: params?.signal });
  }

  /** Get a scheduled task by ID */
  async ScheduledTasksController_getScheduledTask(params: { id: string; signal?: AbortSignal }): Promise<ScheduledTaskResponseDto> {
    return this.request('GET', `/api/v1/scheduled-tasks/${params.id}`, { signal: params?.signal });
  }

  /** Update a scheduled task */
  async ScheduledTasksController_updateScheduledTask(params: { id: string; body: UpdateScheduledTaskDto; signal?: AbortSignal }): Promise<ScheduledTaskResponseDto> {
    return this.request('PATCH', `/api/v1/scheduled-tasks/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Delete a scheduled task */
  async ScheduledTasksController_deleteScheduledTask(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/scheduled-tasks/${params.id}`, { responseType: 'void', signal: params?.signal });
  }

}