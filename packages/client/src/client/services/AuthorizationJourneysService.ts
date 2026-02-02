/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthJourneyResponseDto } from '../models/AuthJourneyResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AuthorizationJourneysService {
    /**
     * Get authorization journeys for an MCP server (debug/monitoring)
     * @param serverId Server UUID
     * @returns AuthJourneyResponseDto List of authorization journeys
     * @throws ApiError
     */
    public static authJourneysControllerGetAuthJourneys(
        serverId: string,
    ): CancelablePromise<Array<AuthJourneyResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth-journeys/servers/{serverId}',
            path: {
                'serverId': serverId,
            },
            errors: {
                404: `Server not found`,
            },
        });
    }
}
