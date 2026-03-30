import { BaseClient, ClientConfig } from './base-client.js';
import type { AddParticipantDto, AppendThreadStateDto, AttachTaskDto, CreateTagDto, CreateThreadDto, CreateThreadMessageDto, ListThreadMessagesResponseDto, ReferenceContextBlockDto, ThreadListResponseDto, ThreadMessageResponseDto, ThreadResponseDto, ThreadStateResponseDto, UpdateThreadDto, UpdateThreadStateDto } from './types.js';

export class ThreadsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new thread */
  async ThreadsController_createThread(params: { body: CreateThreadDto; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('POST', '/api/v1/threads', { body: params.body, signal: params?.signal });
  }

  /** List all threads with lightweight retrieval */
  async ThreadsController_listThreads(params?: { page?: number; limit?: number; signal?: AbortSignal }): Promise<ThreadListResponseDto> {
    return this.request('GET', '/api/v1/threads', { params: { page: params?.page, limit: params?.limit }, signal: params?.signal });
  }

  /** Update thread title */
  async ThreadsController_updateThread(params: { id: string; body: UpdateThreadDto; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('PATCH', `/api/v1/threads/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Get a thread by ID with full details */
  async ThreadsController_getThread(params: { id: string; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('GET', `/api/v1/threads/${params.id}`, { signal: params?.signal });
  }

  /** Delete a thread */
  async ThreadsController_deleteThread(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/threads/${params.id}`, { signal: params?.signal });
  }

  /** Get a thread by task ID */
  async ThreadsController_getThreadByTaskId(params: { taskId: string; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('GET', `/api/v1/threads/by-task/${params.taskId}`, { signal: params?.signal });
  }

  /** Attach a task to the thread */
  async ThreadsController_attachTask(params: { id: string; body: AttachTaskDto; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('POST', `/api/v1/threads/${params.id}/tasks`, { body: params.body, signal: params?.signal });
  }

  /** Reference a context block in the thread */
  async ThreadsController_referenceContextBlock(params: { id: string; body: ReferenceContextBlockDto; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('POST', `/api/v1/threads/${params.id}/context-blocks`, { body: params.body, signal: params?.signal });
  }

  /** Add a tag to a thread */
  async ThreadsController_addTagToThread(params: { id: string; body: CreateTagDto; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('POST', `/api/v1/threads/${params.id}/tags`, { body: params.body, signal: params?.signal });
  }

  /** Remove a tag from a thread */
  async ThreadsController_removeTagFromThread(params: { id: string; tagId: string; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('DELETE', `/api/v1/threads/${params.id}/tags/${params.tagId}`, { signal: params?.signal });
  }

  /** Add a participant to the thread */
  async ThreadsController_addParticipant(params: { id: string; body: AddParticipantDto; signal?: AbortSignal }): Promise<ThreadResponseDto> {
    return this.request('POST', `/api/v1/threads/${params.id}/participants`, { body: params.body, signal: params?.signal });
  }

  /** Get the state of a thread */
  async ThreadsController_getThreadState(params: { id: string; signal?: AbortSignal }): Promise<ThreadStateResponseDto> {
    return this.request('GET', `/api/v1/threads/${params.id}/state`, { signal: params?.signal });
  }

  /** Update the state of a thread */
  async ThreadsController_updateThreadState(params: { id: string; body: UpdateThreadStateDto; signal?: AbortSignal }): Promise<ThreadStateResponseDto> {
    return this.request('PATCH', `/api/v1/threads/${params.id}/state`, { body: params.body, signal: params?.signal });
  }

  /** Append content to the state of a thread */
  async ThreadsController_appendThreadState(params: { id: string; body: AppendThreadStateDto; signal?: AbortSignal }): Promise<ThreadStateResponseDto> {
    return this.request('POST', `/api/v1/threads/${params.id}/state/append`, { body: params.body, signal: params?.signal });
  }

  /** Create a message in the thread */
  async ThreadsController_createMessage(params: { id: string; body: CreateThreadMessageDto; signal?: AbortSignal }): Promise<ThreadMessageResponseDto> {
    return this.request('POST', `/api/v1/threads/${params.id}/messages`, { body: params.body, signal: params?.signal });
  }

  /** List messages in a thread */
  async ThreadsController_listMessages(params: { id: string; page?: number; limit?: number; signal?: AbortSignal }): Promise<ListThreadMessagesResponseDto> {
    return this.request('GET', `/api/v1/threads/${params.id}/messages`, { params: { page: params.page, limit: params.limit }, signal: params?.signal });
  }

}