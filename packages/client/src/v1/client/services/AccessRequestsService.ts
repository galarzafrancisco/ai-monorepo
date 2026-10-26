/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateAccessRequestDto } from '../models/CreateAccessRequestDto.js';
import type { CreateAccessRequestResponseDto } from '../models/CreateAccessRequestResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AccessRequestsService {
    /**
     * Public: express interest in access (write-only)
     * @param requestBody
     * @returns CreateAccessRequestResponseDto
     * @throws ApiError
     */
    public static accessRequestsControllerCreate(
        requestBody: CreateAccessRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<CreateAccessRequestResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/access-requests',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
