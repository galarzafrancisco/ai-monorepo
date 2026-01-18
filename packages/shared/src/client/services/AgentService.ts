/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentListResponseDto } from '../models/AgentListResponseDto';
import type { AgentResponseDto } from '../models/AgentResponseDto';
import type { CreateAgentDto } from '../models/CreateAgentDto';
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
     * Get an agent by slug
     * @param slug Agent slug
     * @returns AgentResponseDto
     * @throws ApiError
     */
    public static agentsControllerGetAgentBySlug(
        slug: string,
    ): CancelablePromise<AgentResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/agents/{slug}',
            path: {
                'slug': slug,
            },
        });
    }
}
