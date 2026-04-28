/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AccountSetupStatusRequestDto } from '../models/AccountSetupStatusRequestDto.js';
import type { AccountSetupStatusResponseDto } from '../models/AccountSetupStatusResponseDto.js';
import type { ChangePasswordRequestDto } from '../models/ChangePasswordRequestDto.js';
import type { CreateManagedUserRequestDto } from '../models/CreateManagedUserRequestDto.js';
import type { LoginRequestDto } from '../models/LoginRequestDto.js';
import type { LoginResponseDto } from '../models/LoginResponseDto.js';
import type { ManagedUserResponseDto } from '../models/ManagedUserResponseDto.js';
import type { OnboardingRequestDto } from '../models/OnboardingRequestDto.js';
import type { OnboardingStatusResponseDto } from '../models/OnboardingStatusResponseDto.js';
import type { SetupManagedUserRequestDto } from '../models/SetupManagedUserRequestDto.js';
import type { UserResponseDto } from '../models/UserResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<LoginResponseDto> {
        return __request(config, {
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
     * List human users for admin user management
     * @returns ManagedUserResponseDto
     * @throws ApiError
     */
    public static webAuthControllerListUsers(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<ManagedUserResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/auth/users',
        });
    }
    /**
     * Create an invited human user
     * @param requestBody
     * @returns ManagedUserResponseDto
     * @throws ApiError
     */
    public static webAuthControllerCreateUser(
        requestBody: CreateManagedUserRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ManagedUserResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/auth/users',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Reset a managed user password so they can set a new one
     * @param userId
     * @returns ManagedUserResponseDto
     * @throws ApiError
     */
    public static webAuthControllerResetUserPassword(
        userId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ManagedUserResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/auth/users/{userId}/reset-password',
            path: {
                'userId': userId,
            },
        });
    }
    /**
     * Deactivate a managed user
     * @param userId
     * @returns ManagedUserResponseDto
     * @throws ApiError
     */
    public static webAuthControllerDeleteUser(
        userId: string,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<ManagedUserResponseDto> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/auth/users/{userId}',
            path: {
                'userId': userId,
            },
        });
    }
    /**
     * Check whether an invited or reset account can be set up
     * @param requestBody
     * @returns AccountSetupStatusResponseDto
     * @throws ApiError
     */
    public static webAuthControllerGetAccountSetupStatus(
        requestBody: AccountSetupStatusRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AccountSetupStatusResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/auth/account-setup-status',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Set up an invited or reset account and log in
     * @param requestBody
     * @returns LoginResponseDto
     * @throws ApiError
     */
    public static webAuthControllerSetupAccount(
        requestBody: SetupManagedUserRequestDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<LoginResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/auth/setup-account',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Refresh access token using refresh token
     * @returns LoginResponseDto Token refreshed successfully, new tokens set in cookies
     * @throws ApiError
     */
    public static webAuthControllerRefresh(config: OpenAPIConfig = OpenAPI): CancelablePromise<LoginResponseDto> {
        return __request(config, {
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
    public static webAuthControllerLogout(config: OpenAPIConfig = OpenAPI): CancelablePromise<{
        ok?: boolean;
    }> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/auth/logout',
        });
    }
    /**
     * Get current authenticated user
     * @returns UserResponseDto Current user information
     * @throws ApiError
     */
    public static webAuthControllerMe(config: OpenAPIConfig = OpenAPI): CancelablePromise<UserResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<{
        ok?: boolean;
    }> {
        return __request(config, {
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
    public static webAuthControllerGetOnboardingStatus(config: OpenAPIConfig = OpenAPI): CancelablePromise<OnboardingStatusResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<LoginResponseDto> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/auth/onboard',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                409: `Admin users already exist, onboarding not allowed`,
            },
        });
    }
    /**
     * Mark walkthrough as seen for authenticated user
     * @returns any Walkthrough marked as seen
     * @throws ApiError
     */
    public static webAuthControllerMarkWalkthroughSeen(config: OpenAPIConfig = OpenAPI): CancelablePromise<{
        ok?: boolean;
    }> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/auth/mark-walkthrough-seen',
            errors: {
                401: `Not authenticated`,
            },
        });
    }
}
