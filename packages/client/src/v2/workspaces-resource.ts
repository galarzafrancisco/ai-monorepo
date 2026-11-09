import { BaseClient, ClientConfig } from './base-client.js';
import type { AcceptInvitationNewAccountRequestDto, AcceptInvitationResponseDto, CreateWorkspaceRequestDto, InvitationCodeRequestDto, InvitationPreviewResponseDto, InviteWorkspaceMemberRequestDto, InviteWorkspaceMemberResponseDto, LocatableRowKind, UpdateWorkspaceMemberRequestDto, WorkspaceInvitationResponseDto, WorkspaceMemberResponseDto, WorkspaceResponseDto } from './types.js';

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

  /** Workspace admin: invitations not yet accepted */
  async WorkspaceAdminController_listInvitations(params?: { signal?: AbortSignal }): Promise<WorkspaceInvitationResponseDto[]> {
    return this.request('GET', '/api/v1/workspaces/current/invitations', { signal: params?.signal });
  }

  /** Workspace admin: revoke an invitation */
  async WorkspaceAdminController_revokeInvitation(params: { invitationId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/workspaces/current/invitations/${params.invitationId}`, { responseType: 'void', signal: params?.signal });
  }

  /** What an invitation is for, to whoever holds its code */
  async WorkspaceAdminController_previewInvitation(params: { body: InvitationCodeRequestDto; signal?: AbortSignal }): Promise<InvitationPreviewResponseDto> {
    return this.request('POST', '/api/v1/workspaces/invitations/preview', { body: params.body, signal: params?.signal });
  }

  /** Accept an invitation by creating the invited account */
  async WorkspaceAdminController_acceptInvitationWithNewAccount(params: { body: AcceptInvitationNewAccountRequestDto; signal?: AbortSignal }): Promise<AcceptInvitationResponseDto> {
    return this.request('POST', '/api/v1/workspaces/invitations/accept-new-account', { body: params.body, signal: params?.signal });
  }

  /** Accept an invitation as the signed-in person */
  async WorkspaceAdminController_acceptInvitation(params: { body: InvitationCodeRequestDto; signal?: AbortSignal }): Promise<AcceptInvitationResponseDto> {
    return this.request('POST', '/api/v1/workspaces/invitations/accept', { body: params.body, signal: params?.signal });
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