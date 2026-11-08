/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceRole } from './WorkspaceRole.js';
export type InviteWorkspaceMemberRequestDto = {
    /**
     * A person with an account is added; anyone else gets an invited account, set up through account setup.
     */
    email: string;
    role: WorkspaceRole;
};

