/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangePasswordRequestDto } from '../models/ChangePasswordRequestDto.js';
import type { LoginRequestDto } from '../models/LoginRequestDto.js';
import type { LoginResponseDto } from '../models/LoginResponseDto.js';
import type { OnboardingRequestDto } from '../models/OnboardingRequestDto.js';
import type { OnboardingStatusResponseDto } from '../models/OnboardingStatusResponseDto.js';
import type { UserResponseDto } from '../models/UserResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
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
    /**
     * Change password for authenticated user
     * @param requestBody
     * @returns any Password changed successfully
     * @throws ApiError
     */
    public static webAuthControllerChangePassword(
        requestBody: ChangePasswordRequestDto,
    ): CancelablePromise<{
        ok?: boolean;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/change-password',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Not authenticated or current password is incorrect`,
            },
        });
    }
    /**
     * Check if system needs onboarding
     * @returns OnboardingStatusResponseDto Onboarding status
     * @throws ApiError
     */
    public static webAuthControllerGetOnboardingStatus(): CancelablePromise<OnboardingStatusResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/onboarding-status',
        });
    }
    /**
     * Create first admin user (only works if no admins exist)
     * @param requestBody
     * @returns LoginResponseDto First admin user created and logged in
     * @throws ApiError
     */
    public static webAuthControllerOnboard(
        requestBody: OnboardingRequestDto,
    ): CancelablePromise<LoginResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/onboard',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                409: `Admin users already exist, onboarding not allowed`,
            },
        });
    }
}
