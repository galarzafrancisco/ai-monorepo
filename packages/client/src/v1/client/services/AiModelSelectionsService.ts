/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiModelSelectionResponseDto } from '../models/AiModelSelectionResponseDto.js';
import type { SetAiModelSelectionDto } from '../models/SetAiModelSelectionDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AiModelSelectionsService {
    /**
     * List which model each job uses
     * @returns AiModelSelectionResponseDto One entry per job, selected or not
     * @throws ApiError
     */
    public static aiModelSelectionsControllerListAiModelSelections(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<AiModelSelectionResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/ai-model-selections',
        });
    }
    /**
     * Select the provider and model a job uses
     * @param job The job the model is selected for
     * @param requestBody
     * @returns AiModelSelectionResponseDto Selection saved
     * @throws ApiError
     */
    public static aiModelSelectionsControllerSetAiModelSelection(
        job: 'conversation' | 'quick_tasks' | 'middle_manager' | 'embeddings',
        requestBody: SetAiModelSelectionDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<AiModelSelectionResponseDto> {
        return __request(config, {
            method: 'PUT',
            url: '/api/v1/ai-model-selections/{job}',
            path: {
                'job': job,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `AI provider not found`,
            },
        });
    }
    /**
     * Clear a job's selection
     * @param job The job the model is selected for
     * @returns void
     * @throws ApiError
     */
    public static aiModelSelectionsControllerClearAiModelSelection(
        job: 'conversation' | 'quick_tasks' | 'middle_manager' | 'embeddings',
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/ai-model-selections/{job}',
            path: {
                'job': job,
            },
        });
    }
}
