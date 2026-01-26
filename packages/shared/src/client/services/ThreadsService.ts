/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ThreadsService {
    /**
     * List threads (placeholder)
     * @returns any Returns list of threads
     * @throws ApiError
     */
    public static threadsControllerListThreads(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/threads',
        });
    }
}
