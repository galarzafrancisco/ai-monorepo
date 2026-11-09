/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceRole } from './WorkspaceRole.js';
export type WorkspaceInvitationResponseDto = {
    id: string;
    /**
     * The invited email address
     */
    email: string;
    role: WorkspaceRole;
    expiresAt: string;
    createdAt: string;
};

