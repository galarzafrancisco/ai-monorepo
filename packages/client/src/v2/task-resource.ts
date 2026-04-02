import { BaseClient, ClientConfig } from './base-client.js';
import type { AnswerInputRequestDto, ArtefactResponseDto, AssignTaskDto, ChangeTaskStatusDto, CommentResponseDto, CreateArtefactDto, CreateCommentDto, CreateInputRequestDto, CreateTagDto, CreateTaskDto, InputRequestResponseDto, TaskListResponseDto, TaskResponseDto, TaskSearchResultDto, UpdateTaskDto } from './types.js';

export class TaskResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new task */
  async TasksController_createTask(params: { body: CreateTaskDto; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('POST', '/api/v1/tasks/tasks', { body: params.body, signal: params?.signal });
  }

  /** List tasks with optional filtering and pagination */
  async TasksController_listTasks(params?: { assignee?: string; sessionId?: string; tag?: string; page?: number; limit?: number; signal?: AbortSignal }): Promise<TaskListResponseDto> {
    return this.request('GET', '/api/v1/tasks/tasks', { params: { assignee: params?.assignee, sessionId: params?.sessionId, tag: params?.tag, page: params?.page, limit: params?.limit }, signal: params?.signal });
  }

  /** Update task description */
  async TasksController_updateTask(params: { id: string; body: UpdateTaskDto; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('PATCH', `/api/v1/tasks/tasks/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Delete a task */
  async TasksController_deleteTask(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/tasks/tasks/${params.id}`, { signal: params?.signal });
  }

  /** Get a task by ID */
  async TasksController_getTask(params: { id: string; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('GET', `/api/v1/tasks/tasks/${params.id}`, { signal: params?.signal });
  }

  /** Assign a task to someone */
  async TasksController_assignTask(params: { id: string; body: AssignTaskDto; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('PATCH', `/api/v1/tasks/tasks/${params.id}/assign`, { body: params.body, signal: params?.signal });
  }

  /** Assign a task to the current user */
  async TasksController_assignTaskToMe(params: { id: string; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('PATCH', `/api/v1/tasks/tasks/${params.id}/assign-to-me`, { signal: params?.signal });
  }

  /** Search tasks by query string */
  async TasksController_searchTasks(params: { query: string; limit?: number; threshold?: number; signal?: AbortSignal }): Promise<TaskSearchResultDto[]> {
    return this.request('GET', '/api/v1/tasks/tasks/search/query', { params: { query: params.query, limit: params.limit, threshold: params.threshold }, signal: params?.signal });
  }

  /** Add a comment to a task */
  async TasksController_addComment(params: { id: string; body: CreateCommentDto; signal?: AbortSignal }): Promise<CommentResponseDto> {
    return this.request('POST', `/api/v1/tasks/tasks/${params.id}/comments`, { body: params.body, signal: params?.signal });
  }

  /** Add an artefact to a task */
  async TasksController_addArtefact(params: { id: string; body: CreateArtefactDto; signal?: AbortSignal }): Promise<ArtefactResponseDto> {
    return this.request('POST', `/api/v1/tasks/tasks/${params.id}/artefacts`, { body: params.body, signal: params?.signal });
  }

  /** Change task status */
  async TasksController_changeStatus(params: { id: string; body: ChangeTaskStatusDto; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('PATCH', `/api/v1/tasks/tasks/${params.id}/status`, { body: params.body, signal: params?.signal });
  }

  /** Add a tag to a task */
  async TasksController_addTagToTask(params: { id: string; body: CreateTagDto; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('POST', `/api/v1/tasks/tasks/${params.id}/tags`, { body: params.body, signal: params?.signal });
  }

  /** Remove a tag from a task */
  async TasksController_removeTagFromTask(params: { id: string; tagId: string; signal?: AbortSignal }): Promise<TaskResponseDto> {
    return this.request('DELETE', `/api/v1/tasks/tasks/${params.id}/tags/${params.tagId}`, { signal: params?.signal });
  }

  /** Create an input request for a task */
  async TasksController_createInputRequest(params: { id: string; body: CreateInputRequestDto; signal?: AbortSignal }): Promise<InputRequestResponseDto> {
    return this.request('POST', `/api/v1/tasks/tasks/${params.id}/input-requests`, { body: params.body, signal: params?.signal });
  }

  /** Answer an input request */
  async TasksController_answerInputRequest(params: { id: string; inputRequestId: string; body: AnswerInputRequestDto; signal?: AbortSignal }): Promise<InputRequestResponseDto> {
    return this.request('POST', `/api/v1/tasks/tasks/${params.id}/input-requests/${params.inputRequestId}/answer`, { body: params.body, signal: params?.signal });
  }

  async TasksController_handleMcp_get(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('GET', '/api/v1/tasks/tasks/mcp', { signal: params?.signal });
  }

  async TasksController_handleMcp_post(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('POST', '/api/v1/tasks/tasks/mcp', { signal: params?.signal });
  }

  async TasksController_handleMcp_put(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('PUT', '/api/v1/tasks/tasks/mcp', { signal: params?.signal });
  }

  async TasksController_handleMcp_delete(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', '/api/v1/tasks/tasks/mcp', { signal: params?.signal });
  }

  async TasksController_handleMcp_patch(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('PATCH', '/api/v1/tasks/tasks/mcp', { signal: params?.signal });
  }

  async TasksController_handleMcp_options(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('OPTIONS', '/api/v1/tasks/tasks/mcp', { signal: params?.signal });
  }

  async TasksController_handleMcp_head(params?: { signal?: AbortSignal }): Promise<void> {
    return this.request('HEAD', '/api/v1/tasks/tasks/mcp', { signal: params?.signal });
  }

}