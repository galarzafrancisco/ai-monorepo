/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LoginRequestDto } from '../models/LoginRequestDto';
import type { LoginResponseDto } from '../models/LoginResponseDto';
import type { UserResponseDto } from '../models/UserResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WebAuthenticationService {
    /**
     * Login with email and password
     * @param requestBody
     * @returns LoginResponseDto Login successful, tokens set in httpOnly cookies
     * @throws ApiError
     */
    public static webAuthControllerLogin(
        requestBody: LoginRequestDto,
    ): CancelablePromise<LoginResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Invalid credentials`,
            },
        });
    }
    /**
     * Refresh access token using refresh token
     * @returns LoginResponseDto Token refreshed successfully, new tokens set in cookies
     * @throws ApiError
     */
    public static webAuthControllerRefresh(): CancelablePromise<LoginResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/refresh',
            errors: {
                401: `Invalid or expired refresh token`,
            },
        });
    }
    /**
     * Logout and revoke refresh token
     * @returns any Logout successful, cookies cleared
     * @throws ApiError
     */
    public static webAuthControllerLogout(): CancelablePromise<{
        ok?: boolean;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/logout',
        });
    }
    /**
     * Get current authenticated user
     * @returns UserResponseDto Current user information
     * @throws ApiError
     */
    public static webAuthControllerMe(): CancelablePromise<UserResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/me',
            errors: {
                401: `Not authenticated`,
            },
        });
    }
}
