/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatePageDto } from '../models/CreatePageDto';
import type { PageListResponseDto } from '../models/PageListResponseDto';
import type { PageResponseDto } from '../models/PageResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class WikirooService {
    /**
     * List wiki pages without content
     * @returns PageListResponseDto List of wiki pages
     * @throws ApiError
     */
    public static wikirooControllerListPages(): CancelablePromise<PageListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/wikiroo/pages',
        });
    }

    /**
     * Create a new wiki page
     * @param requestBody
     * @returns PageResponseDto Wiki page created successfully
     * @throws ApiError
     */
    public static wikirooControllerCreatePage(
        requestBody: CreatePageDto,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/wikiroo/pages',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }

    /**
     * Fetch a wiki page by ID
     * @param id Wiki page identifier
     * @returns PageResponseDto Wiki page retrieved successfully
     * @throws ApiError
     */
    public static wikirooControllerGetPage(
        id: string,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/wikiroo/pages/{id}',
            path: {
                'id': id,
            },
        });
    }
}

