/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentToolPermissionScopeResponseDto } from './AgentToolPermissionScopeResponseDto.js';
import type { AgentToolPermissionServerResponseDto } from './AgentToolPermissionServerResponseDto.js';
export type AgentToolPermissionResponseDto = {
    server: AgentToolPermissionServerResponseDto;
    /**
     * All scopes currently available on this MCP server
     */
    availableScopes: Array<AgentToolPermissionScopeResponseDto>;
    /**
     * Subset of scopes granted to this agent for this server
     */
    grantedScopes: Array<AgentToolPermissionScopeResponseDto>;
    /**
     * True when this assignment grants every currently available scope on the server
     */
    hasAllScopes: boolean;
};

