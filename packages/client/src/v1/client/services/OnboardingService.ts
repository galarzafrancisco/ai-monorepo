/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserOnboardingStatusResponseDto } from '../models/UserOnboardingStatusResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class OnboardingService {
    /**
     * Get onboarding status for the current user
     * @returns UserOnboardingStatusResponseDto Current onboarding progress and display mode
     * @throws ApiError
     */
    public static onboardingControllerGetStatus(config: OpenAPIConfig = OpenAPI): CancelablePromise<UserOnboardingStatusResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/onboarding/status',
        });
    }
}
