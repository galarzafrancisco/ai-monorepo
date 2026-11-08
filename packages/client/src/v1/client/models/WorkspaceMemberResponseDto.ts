/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceMemberActorType } from './WorkspaceMemberActorType.js';
import type { WorkspaceRole } from './WorkspaceRole.js';
export type WorkspaceMemberResponseDto = {
    actorId: string;
    type: WorkspaceMemberActorType;
    slug: string;
    displayName: string;
    avatarUrl: string | null;
    role: WorkspaceRole;
    joinedAt: string;
};

