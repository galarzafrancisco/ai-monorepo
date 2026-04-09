/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentListResponseDto } from '../models/AgentListResponseDto.js';
import type { AgentResponseDto } from '../models/AgentResponseDto.js';
import type { AgentToolPermissionResponseDto } from '../models/AgentToolPermissionResponseDto.js';
import type { CreateAgentDto } from '../models/CreateAgentDto.js';
import type { PatchAgentDto } from '../models/PatchAgentDto.js';
import type { UpsertAgentToolPermissionDto } from '../models/UpsertAgentToolPermissionDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AgentService {
    /**
     * Create a new agent
     * @param requestBody
     * @returns AgentResponseDto
     * @throws ApiError
     */
    public static agentsControllerCreateAgent(
        requestBody: CreateAgentDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/agents',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List agents with optional filtering and pagination
     * @param isActive Filter by active status
     * @param page Page number for pagination
     * @param limit Number of items per page
     * @returns AgentListResponseDto
     * @throws ApiError
     */
    public static agentsControllerListAgents(
        isActive?: boolean,
        page: number = 1,
        limit: number = 20,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/agents',
            query: {
                'isActive': isActive,
                'page': page,
                'limit': limit,
            },
        });
    }
    /**
     * Get an agent by slug
     * @param slug Agent slug
     * @returns AgentResponseDto
     * @throws ApiError
     */
    public static agentsControllerGetAgentBySlug(
        slug: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/agents/{slug}',
            path: {
                'slug': slug,
            },
        });
    }
    /**
     * Patch an agent and its linked actor fields
     * @param actorId Agent actor ID
     * @param requestBody
     * @returns AgentResponseDto
     * @throws ApiError
     */
    public static agentsControllerPatchAgent(
        actorId: string,
        requestBody: PatchAgentDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/agents/{actorId}',
            path: {
                'actorId': actorId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete an agent
     * @param actorId Agent actor ID
     * @returns void
     * @throws ApiError
     */
    public static agentsControllerDeleteAgent(
        actorId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/agents/{actorId}',
            path: {
                'actorId': actorId,
            },
        });
    }
    /**
     * List tool permissions for an agent
     * @param actorId Agent actor ID
     * @returns AgentToolPermissionResponseDto
     * @throws ApiError
     */
    public static agentToolPermissionsControllerListAgentToolPermissions(
        actorId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<AgentToolPermissionResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/agents/{actorId}/tool-permissions',
            path: {
                'actorId': actorId,
            },
        });
    }
    /**
     * Create or replace an agent tool permission assignment
     * @param actorId
     * @param serverId MCP server UUID used by this assignment
     * @param requestBody
     * @returns AgentToolPermissionResponseDto
     * @throws ApiError
     */
    public static agentToolPermissionsControllerUpsertAgentToolPermission(
        actorId: string,
        serverId: string,
        requestBody: UpsertAgentToolPermissionDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentToolPermissionResponseDto> {
        return __request(config, {
            method: 'PUT',
            url: '/api/v1/agents/{actorId}/tool-permissions/{serverId}',
            path: {
                'actorId': actorId,
                'serverId': serverId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete an agent tool permission assignment
     * @param actorId
     * @param serverId
     * @returns void
     * @throws ApiError
     */
    public static agentToolPermissionsControllerDeleteAgentToolPermission(
        actorId: string,
        serverId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/agents/{actorId}/tool-permissions/{serverId}',
            path: {
                'actorId': actorId,
                'serverId': serverId,
            },
        });
    }
}
