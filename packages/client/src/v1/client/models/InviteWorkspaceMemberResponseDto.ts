/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceInvitationResponseDto } from './WorkspaceInvitationResponseDto.js';
export type InviteWorkspaceMemberResponseDto = {
    invitation: WorkspaceInvitationResponseDto;
    /**
     * One-time code that accepts the invitation. Shown once: give it, or the link, to the person by a channel you trust.
     */
    inviteCode: string;
    /**
     * Link that opens the invitation with the code filled in. Shown once.
     */
    inviteUrl: string;
};

