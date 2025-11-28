/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentListResponseDto } from '../models/AgentListResponseDto';
import type { AgentResponseDto } from '../models/AgentResponseDto';
import type { CreateAgentDto } from '../models/CreateAgentDto';
import type { UpdateAgentDto } from '../models/UpdateAgentDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AgentService {
    /**
     * Create a new agent
     * @param requestBody
     * @returns AgentResponseDto
     * @throws ApiError
     */
    public static agentsControllerCreateAgent(
        requestBody: CreateAgentDto,
    ): CancelablePromise<AgentResponseDto> {
        return __request(OpenAPI, {
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
    ): CancelablePromise<AgentListResponseDto> {
        return __request(OpenAPI, {
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
     * Get an agent by ID
     * @param id Agent ID
     * @returns AgentResponseDto
     * @throws ApiError
     */
    public static agentsControllerGetAgent(
        id: string,
    ): CancelablePromise<AgentResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/agents/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Update an agent
     * @param id Agent ID
     * @param requestBody
     * @returns AgentResponseDto
     * @throws ApiError
     */
    public static agentsControllerUpdateAgent(
        id: string,
        requestBody: UpdateAgentDto,
    ): CancelablePromise<AgentResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/agents/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete an agent
     * @param id Agent ID
     * @returns void
     * @throws ApiError
     */
    public static agentsControllerDeleteAgent(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/agents/{id}',
            path: {
                'id': id,
            },
        });
    }
}
