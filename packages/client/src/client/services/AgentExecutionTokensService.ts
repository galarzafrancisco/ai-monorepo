/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentExecutionTokenResponseDto } from '../models/AgentExecutionTokenResponseDto.js';
import type { RequestAgentExecutionTokenDto } from '../models/RequestAgentExecutionTokenDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AgentExecutionTokensService {
    /**
     * Request a short-lived execution token for an agent
     * @param slug Agent slug
     * @param requestBody
     * @returns AgentExecutionTokenResponseDto
     * @throws ApiError
     */
    public static agentExecutionTokensControllerRequestExecutionToken(
        slug: string,
        requestBody: RequestAgentExecutionTokenDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AgentExecutionTokenResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/agents/{slug}/execution-token',
            path: {
                'slug': slug,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
