/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentListResponseDto } from '../models/AgentListResponseDto.js';
import type { AgentResponseDto } from '../models/AgentResponseDto.js';
import type { CreateAgentDto } from '../models/CreateAgentDto.js';
import type { PatchAgentDto } from '../models/PatchAgentDto.js';
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
}
