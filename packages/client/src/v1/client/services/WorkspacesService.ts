/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AcceptInvitationNewAccountRequestDto } from '../models/AcceptInvitationNewAccountRequestDto.js';
import type { AcceptInvitationResponseDto } from '../models/AcceptInvitationResponseDto.js';
import type { CreateWorkspaceRequestDto } from '../models/CreateWorkspaceRequestDto.js';
import type { InvitationCodeRequestDto } from '../models/InvitationCodeRequestDto.js';
import type { InvitationPreviewResponseDto } from '../models/InvitationPreviewResponseDto.js';
import type { InviteWorkspaceMemberRequestDto } from '../models/InviteWorkspaceMemberRequestDto.js';
import type { InviteWorkspaceMemberResponseDto } from '../models/InviteWorkspaceMemberResponseDto.js';
import type { LocatableRowKind } from '../models/LocatableRowKind.js';
import type { UpdateWorkspaceMemberRequestDto } from '../models/UpdateWorkspaceMemberRequestDto.js';
import type { WorkspaceInvitationResponseDto } from '../models/WorkspaceInvitationResponseDto.js';
import type { WorkspaceMemberResponseDto } from '../models/WorkspaceMemberResponseDto.js';
import type { WorkspaceResponseDto } from '../models/WorkspaceResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class WorkspacesService {
    /**
     * List the workspaces you are a member of
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerListMine(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<WorkspaceResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/workspaces',
        });
    }
    /**
     * Installation operator: create a workspace
     * You become its admin. It starts with the system tags, the taico agent and unconfigured AI providers. Switch to it to work in it.
     * @param requestBody
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerCreate(
        requestBody: CreateWorkspaceRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<WorkspaceResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/workspaces',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Find which of your workspaces a task, thread or context block is in
     * For links to a row of another workspace: the UI offers to switch instead of showing not found. A row that does not exist and one in a workspace you are not in both answer 404.
     * @param kind
     * @param id
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerLocate(
        kind: LocatableRowKind,
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<WorkspaceResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/workspaces/locate',
            query: {
                'kind': kind,
                'id': id,
            },
        });
    }
    /**
     * The token's workspace, with your role in it
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerGetCurrent(config: OpenAPIConfig = OpenAPI): CancelablePromise<WorkspaceResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/workspaces/current',
        });
    }
    /**
     * List the members (people and agents) of your workspace
     * @returns WorkspaceMemberResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerListMembers(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<WorkspaceMemberResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/workspaces/current/members',
        });
    }
    /**
     * Workspace admin: invite a person by email
     * Creates an invitation with a one-time code; nobody is added until the person accepts it with that code. The answer is the same whether or not the email has an account.
     * @param requestBody
     * @returns InviteWorkspaceMemberResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerInvite(
        requestBody: InviteWorkspaceMemberRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<InviteWorkspaceMemberResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/workspaces/current/members',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Workspace admin: invitations not yet accepted
     * @returns WorkspaceInvitationResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerListInvitations(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<WorkspaceInvitationResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/workspaces/current/invitations',
        });
    }
    /**
     * Workspace admin: revoke an invitation
     * @param invitationId
     * @returns void
     * @throws ApiError
     */
    public static workspaceAdminControllerRevokeInvitation(
        invitationId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/workspaces/current/invitations/{invitationId}',
            path: {
                'invitationId': invitationId,
            },
        });
    }
    /**
     * What an invitation is for, to whoever holds its code
     * A wrong, used, revoked or expired code answers 404.
     * @param requestBody
     * @returns InvitationPreviewResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerPreviewInvitation(
        requestBody: InvitationCodeRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<InvitationPreviewResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/workspaces/invitations/preview',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Accept an invitation by creating the invited account
     * Creates the account for the invited email, with this password, in the workspace. Then sign in. If the email already has an account, sign in to it and accept instead (409).
     * @param requestBody
     * @returns AcceptInvitationResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerAcceptInvitationWithNewAccount(
        requestBody: AcceptInvitationNewAccountRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AcceptInvitationResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/workspaces/invitations/accept-new-account',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Accept an invitation as the signed-in person
     * The account must have the invited email. Joins the workspace; switch to it to work there.
     * @param requestBody
     * @returns AcceptInvitationResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerAcceptInvitation(
        requestBody: InvitationCodeRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AcceptInvitationResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/workspaces/invitations/accept',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Workspace admin: change a person's role
     * Takes effect in their next token. The last admin cannot be demoted.
     * @param actorId
     * @param requestBody
     * @returns WorkspaceMemberResponseDto
     * @throws ApiError
     */
    public static workspaceAdminControllerUpdateMember(
        actorId: string,
        requestBody: UpdateWorkspaceMemberRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<WorkspaceMemberResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/workspaces/current/members/{actorId}',
            path: {
                'actorId': actorId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Workspace admin: remove a person from the workspace
     * They lose access at their next token: tokens already minted stay valid until they expire. The last admin cannot be removed; agents are deleted, not removed.
     * @param actorId
     * @returns void
     * @throws ApiError
     */
    public static workspaceAdminControllerRemoveMember(
        actorId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/workspaces/current/members/{actorId}',
            path: {
                'actorId': actorId,
            },
        });
    }
}
