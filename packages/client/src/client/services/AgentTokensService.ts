/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IssueAccessTokenRequestDto } from '../models/IssueAccessTokenRequestDto';
import type { IssueAccessTokenResponseDto } from '../models/IssueAccessTokenResponseDto';
import type { IssuedAccessTokenResponseDto } from '../models/IssuedAccessTokenResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AgentTokensService {
    /**
     * Issue a new access token for an agent
     * @param slug Agent slug
     * @param requestBody
     * @returns IssueAccessTokenResponseDto
     * @throws ApiError
     */
    public static agentTokensControllerIssueToken(
        slug: string,
        requestBody: IssueAccessTokenRequestDto,
    ): CancelablePromise<IssueAccessTokenResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/agents/{slug}/tokens',
            path: {
                'slug': slug,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List all tokens for an agent
     * @param slug Agent slug
     * @returns IssuedAccessTokenResponseDto
     * @throws ApiError
     */
    public static agentTokensControllerListTokens(
        slug: string,
    ): CancelablePromise<Array<IssuedAccessTokenResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/agents/{slug}/tokens',
            path: {
                'slug': slug,
            },
        });
    }
    /**
     * Revoke an agent token
     * @param slug Agent slug
     * @param tokenId Token ID to revoke
     * @returns IssuedAccessTokenResponseDto
     * @throws ApiError
     */
    public static agentTokensControllerRevokeToken(
        slug: string,
        tokenId: string,
    ): CancelablePromise<IssuedAccessTokenResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/agents/{slug}/tokens/{tokenId}',
            path: {
                'slug': slug,
                'tokenId': tokenId,
            },
        });
    }
}
