/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceRole } from './WorkspaceRole.js';
export type InvitationPreviewResponseDto = {
    workspaceName: string;
    workspaceSlug: string;
    /**
     * The invited email address
     */
    email: string;
    role: WorkspaceRole;
    expiresAt: string;
    /**
     * Whether an account with the invited email exists: sign in to accept, or create one.
     */
    accountExists: boolean;
};

