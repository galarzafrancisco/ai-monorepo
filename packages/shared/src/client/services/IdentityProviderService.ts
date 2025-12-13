/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LoginDto } from '../models/LoginDto';
import type { SessionResponseDto } from '../models/SessionResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class IdentityProviderService {
    /**
     * Login with email and password
     * @param requestBody
     * @returns any Login successful
     * @throws ApiError
     */
    public static identityProviderControllerLogin(
        requestBody: LoginDto,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/login',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Logout and clear session
     * @returns any Logout successful
     * @throws ApiError
     */
    public static identityProviderControllerLogout(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/logout',
        });
    }
    /**
     * Get current session information
     * @returns SessionResponseDto
     * @throws ApiError
     */
    public static identityProviderControllerGetSession(): CancelablePromise<SessionResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/session',
        });
    }
}
