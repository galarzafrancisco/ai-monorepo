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
     * Launch script endpoint
     * @returns string Returns the bash script to launch Taico
     * @throws ApiError
     */
    public static appControllerGetLaunchScript(config: OpenAPIConfig = OpenAPI): CancelablePromise<string> {
        return __request(config, {
            method: 'GET',
            url: '/launch',
        });
    }
}
