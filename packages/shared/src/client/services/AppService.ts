/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AppService {
    /**
     * Health check endpoint
     * @returns string Returns a greeting message
     * @throws ApiError
     */
    public static appControllerGetHello(): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1',
        });
    }
    /**
     * Get a fun fact about your favorite color
     * @param color Your favorite color
     * @returns string Returns a fun fact about the specified color
     * @throws ApiError
     */
    public static appControllerGetColorFact(
        color: string,
    ): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/color-fact',
            query: {
                'color': color,
            },
        });
    }
}
