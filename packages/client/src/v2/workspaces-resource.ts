import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateWorkspaceRequestDto, InviteWorkspaceMemberRequestDto, InviteWorkspaceMemberResponseDto, LocatableRowKind, UpdateWorkspaceMemberRequestDto, WorkspaceMemberResponseDto, WorkspaceResponseDto } from './types.js';

export class WorkspacesResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** List the workspaces you are a member of */
  async WorkspaceAdminController_listMine(params?: { signal?: AbortSignal }): Promise<WorkspaceResponseDto[]> {
    return this.request('GET', '/api/v1/workspaces', { signal: params?.signal });
  }

  /** Installation operator: create a workspace */
  async WorkspaceAdminController_create(params: { body: CreateWorkspaceRequestDto; signal?: AbortSignal }): Promise<WorkspaceResponseDto> {
    return this.request('POST', '/api/v1/workspaces', { body: params.body, signal: params?.signal });
  }

  /** Find which of your workspaces a task, thread or context block is in */
  async WorkspaceAdminController_locate(params: { kind: LocatableRowKind; id: string; signal?: AbortSignal }): Promise<WorkspaceResponseDto> {
    return this.request('GET', '/api/v1/workspaces/locate', { params: { kind: params.kind, id: params.id }, signal: params?.signal });
  }

  /** The token's workspace, with your role in it */
  async WorkspaceAdminController_getCurrent(params?: { signal?: AbortSignal }): Promise<WorkspaceResponseDto> {
    return this.request('GET', '/api/v1/workspaces/current', { signal: params?.signal });
  }

  /** List the members (people and agents) of your workspace */
  async WorkspaceAdminController_listMembers(params?: { signal?: AbortSignal }): Promise<WorkspaceMemberResponseDto[]> {
    return this.request('GET', '/api/v1/workspaces/current/members', { signal: params?.signal });
  }

  /** Workspace admin: invite a person by email */
  async WorkspaceAdminController_invite(params: { body: InviteWorkspaceMemberRequestDto; signal?: AbortSignal }): Promise<InviteWorkspaceMemberResponseDto> {
    return this.request('POST', '/api/v1/workspaces/current/members', { body: params.body, signal: params?.signal });
  }

  /** Workspace admin: change a person's role */
  async WorkspaceAdminController_updateMember(params: { actorId: string; body: UpdateWorkspaceMemberRequestDto; signal?: AbortSignal }): Promise<WorkspaceMemberResponseDto> {
    return this.request('PATCH', `/api/v1/workspaces/current/members/${params.actorId}`, { body: params.body, signal: params?.signal });
  }

  /** Workspace admin: remove a person from the workspace */
  async WorkspaceAdminController_removeMember(params: { actorId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/workspaces/current/members/${params.actorId}`, { responseType: 'void', signal: params?.signal });
  }

}