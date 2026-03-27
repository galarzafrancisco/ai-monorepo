/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentRunListResponseDto } from '../models/AgentRunListResponseDto.js';
import type { AgentRunResponseDto } from '../models/AgentRunResponseDto.js';
import type { CreateAgentRunDto } from '../models/CreateAgentRunDto.js';
import type { UpdateAgentRunDto } from '../models/UpdateAgentRunDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AgentRunService {
    /**
     * Create a new agent run
     * @param requestBody
     * @returns AgentRunResponseDto Agent run created successfully
     * @throws ApiError
     */
    public static agentRunsControllerCreateAgentRun(
        requestBody: CreateAgentRunDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentRunResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/agent-runs',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * List agent runs with optional filters
     * @param actorId Filter by actor ID
     * @param parentTaskId Filter by parent task ID
     * @param page Page number (1-indexed)
     * @param limit Number of items per page
     * @returns AgentRunListResponseDto List of agent runs retrieved successfully
     * @throws ApiError
     */
    public static agentRunsControllerListAgentRuns(
        actorId?: string,
        parentTaskId?: string,
        page: number = 1,
        limit: number = 20,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentRunListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/agent-runs',
            query: {
                'actorId': actorId,
                'parentTaskId': parentTaskId,
                'page': page,
                'limit': limit,
            },
        });
    }
    /**
     * Get an agent run by ID
     * @param runId Agent run ID
     * @returns AgentRunResponseDto Agent run retrieved successfully
     * @throws ApiError
     */
    public static agentRunsControllerGetAgentRunById(
        runId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentRunResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/agent-runs/{runId}',
            path: {
                'runId': runId,
            },
            errors: {
                404: `Agent run not found`,
            },
        });
    }
    /**
     * Update an agent run
     * @param runId Agent run ID
     * @param requestBody
     * @returns AgentRunResponseDto Agent run updated successfully
     * @throws ApiError
     */
    public static agentRunsControllerUpdateAgentRun(
        runId: string,
        requestBody: UpdateAgentRunDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentRunResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/agent-runs/{runId}',
            path: {
                'runId': runId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Agent run not found`,
            },
        });
    }
}
