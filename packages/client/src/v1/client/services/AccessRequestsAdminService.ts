/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AccessRequestListResponseDto } from '../models/AccessRequestListResponseDto.js';
import type { AccessRequestResponseDto } from '../models/AccessRequestResponseDto.js';
import type { AccessRequestStatus } from '../models/AccessRequestStatus.js';
import type { UpdateAccessRequestDto } from '../models/UpdateAccessRequestDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AccessRequestsAdminService {
    /**
     * Admin: list access requests, most recently submitted first
     * @param status
     * @param search Matches email or answer (case-insensitive)
     * @param limit
     * @param offset
     * @returns AccessRequestListResponseDto
     * @throws ApiError
     */
    public static accessRequestsAdminControllerList(
        status?: AccessRequestStatus,
        search?: string,
        limit: number = 50,
        offset?: number,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AccessRequestListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/admin/access-requests',
            query: {
                'status': status,
                'search': search,
                'limit': limit,
                'offset': offset,
            },
        });
    }
    /**
     * Admin: mark an access request new or reviewed
     * @param id
     * @param requestBody
     * @returns AccessRequestResponseDto
     * @throws ApiError
     */
    public static accessRequestsAdminControllerUpdate(
        id: string,
        requestBody: UpdateAccessRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AccessRequestResponseDto> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/admin/access-requests/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Admin: delete an access request
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static accessRequestsAdminControllerRemove(
        id: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/admin/access-requests/{id}',
            path: {
                'id': id,
            },
        });
    }
}
