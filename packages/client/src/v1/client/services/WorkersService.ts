/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkerResponseDto } from '../models/WorkerResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class WorkersService {
    /**
     * List all workers
     * @returns WorkerResponseDto List of all registered workers
     * @throws ApiError
     */
    public static workersControllerListWorkers(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<WorkerResponseDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/workers',
        });
    }
}
