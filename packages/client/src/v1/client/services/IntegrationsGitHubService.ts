/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateGithubConnectionDto } from '../models/CreateGithubConnectionDto.js';
import type { GithubConnectionResponseDto } from '../models/GithubConnectionResponseDto.js';
import type { GithubWebhookSettingsResponseDto } from '../models/GithubWebhookSettingsResponseDto.js';
import type { ResolvedGithubConnectionResponseDto } from '../models/ResolvedGithubConnectionResponseDto.js';
import type { UpdateGithubConnectionDto } from '../models/UpdateGithubConnectionDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class IntegrationsGitHubService {
    /**
     * Connect GitHub with a personal access token or a GitHub App installation
     * @param requestBody
     * @returns GithubConnectionResponseDto
     * @throws ApiError
     */
    public static githubConnectionsControllerCreateConnection(
        requestBody: CreateGithubConnectionDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<GithubConnectionResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/integrations/github/connections',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List GitHub connections
     * @returns GithubConnectionResponseDto
     * @throws ApiError
     */
    public static githubConnectionsControllerListConnections(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<GithubConnectionResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/integrations/github/connections',
        });
    }
    /**
     * Which connection Taico would use for a repository, and why
     * @param repoUrl Repository URL (web or clone URL)
     * @param connectionId The connection the project names, if any
     * @returns ResolvedGithubConnectionResponseDto
     * @throws ApiError
     */
    public static githubConnectionsControllerResolveConnection(
        repoUrl: string,
        connectionId?: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ResolvedGithubConnectionResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/integrations/github/connections/resolve',
            query: {
                'repoUrl': repoUrl,
                'connectionId': connectionId,
            },
        });
    }
    /**
     * Get a GitHub connection
     * @param id GitHub connection id
     * @returns GithubConnectionResponseDto
     * @throws ApiError
     */
    public static githubConnectionsControllerGetConnection(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<GithubConnectionResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/integrations/github/connections/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `GitHub connection not found`,
            },
        });
    }
    /**
     * Update a GitHub connection; a new credential is checked with GitHub before it is saved
     * @param id GitHub connection id
     * @param requestBody
     * @returns GithubConnectionResponseDto
     * @throws ApiError
     */
    public static githubConnectionsControllerUpdateConnection(
        id: string,
        requestBody: UpdateGithubConnectionDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<GithubConnectionResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/integrations/github/connections/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `GitHub connection not found`,
            },
        });
    }
    /**
     * Delete a GitHub connection and its stored credential
     * @param id GitHub connection id
     * @returns void
     * @throws ApiError
     */
    public static githubConnectionsControllerDeleteConnection(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/integrations/github/connections/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `GitHub connection not found`,
            },
        });
    }
    /**
     * Check the stored credential with GitHub again
     * @param id GitHub connection id
     * @returns GithubConnectionResponseDto
     * @throws ApiError
     */
    public static githubConnectionsControllerVerifyConnection(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<GithubConnectionResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/integrations/github/connections/{id}/verify',
            path: {
                'id': id,
            },
            errors: {
                404: `GitHub connection not found`,
            },
        });
    }
    /**
     * Webhook address and secret for the connection (the secret is created on first request)
     * @param id GitHub connection id
     * @returns GithubWebhookSettingsResponseDto
     * @throws ApiError
     */
    public static githubConnectionsControllerGetWebhookSettings(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<GithubWebhookSettingsResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/integrations/github/connections/{id}/webhook',
            path: {
                'id': id,
            },
            errors: {
                404: `GitHub connection not found`,
            },
        });
    }
}
