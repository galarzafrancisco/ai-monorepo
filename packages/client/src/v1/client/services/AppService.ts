/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class AppService {
    /**
     * Health check endpoint
     * @returns string Returns a greeting message
     * @throws ApiError
     */
    public static appControllerGetHello(config: OpenAPIConfig = OpenAPI): CancelablePromise<string> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1',
        });
    }
    /**
     * Liveness check endpoint
     * @returns any The process is alive
     * @throws ApiError
     */
    public static appControllerGetLive(config: OpenAPIConfig = OpenAPI): CancelablePromise<{
        status: string;
    }> {
        return __request(config, {
            method: 'GET',
            url: '/health/live',
        });
    }
    /**
     * Readiness check endpoint
     * @returns any The server is ready to accept traffic
     * @throws ApiError
     */
    public static appControllerGetReady(config: OpenAPIConfig = OpenAPI): CancelablePromise<{
        status: string;
    }> {
        return __request(config, {
            method: 'GET',
            url: '/health/ready',
            errors: {
                503: `Shutdown has started and the server is not ready`,
            },
        });
    }
}
