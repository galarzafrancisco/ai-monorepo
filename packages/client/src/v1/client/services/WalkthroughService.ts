/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserWalkthroughStatusResponseDto } from '../models/UserWalkthroughStatusResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class WalkthroughService {
    /**
     * Acknowledge walkthrough — transitions FULL_PAGE display mode to BANNER
     * @returns any Acknowledged
     * @throws ApiError
     */
    public static walkthroughControllerAcknowledge(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/walkthrough/acknowledge',
        });
    }
    /**
     * Get walkthrough status for the current user
     * @returns UserWalkthroughStatusResponseDto Current walkthrough progress and display mode
     * @throws ApiError
     */
    public static walkthroughControllerGetStatus(config: OpenAPIConfig = OpenAPI): CancelablePromise<UserWalkthroughStatusResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/walkthrough/status',
        });
    }
}
