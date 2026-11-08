/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceRole } from './WorkspaceRole.js';
export type WorkspaceResponseDto = {
    id: string;
    slug: string;
    name: string;
    /**
     * The caller's role in it
     */
    role: WorkspaceRole;
    /**
     * Whether the token the request was made with is for this workspace
     */
    current: boolean;
};

