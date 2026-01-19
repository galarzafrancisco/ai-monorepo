/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddContextTagDto } from '../models/AddContextTagDto';
import type { AppendPageDto } from '../models/AppendPageDto';
import type { ContextTagResponseDto } from '../models/ContextTagResponseDto';
import type { CreateContextTagDto } from '../models/CreateContextTagDto';
import type { CreatePageDto } from '../models/CreatePageDto';
import type { MovePageDto } from '../models/MovePageDto';
import type { PageListResponseDto } from '../models/PageListResponseDto';
import type { PageResponseDto } from '../models/PageResponseDto';
import type { PageTreeResponseDto } from '../models/PageTreeResponseDto';
import type { ReorderPageDto } from '../models/ReorderPageDto';
import type { UpdatePageDto } from '../models/UpdatePageDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ContextService {
    /**
     * Create a new wiki page
     * @param requestBody
     * @returns PageResponseDto Context page created successfully
     * @throws ApiError
     */
    public static contextControllerCreatePage(
        requestBody: CreatePageDto,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/context/blocks',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * List wiki pages without content
     * @param tag Filter pages by tag name
     * @returns PageListResponseDto List of wiki pages
     * @throws ApiError
     */
    public static contextControllerListPages(
        tag?: string,
    ): CancelablePromise<PageListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/context/blocks',
            query: {
                'tag': tag,
            },
        });
    }
    /**
     * Get page hierarchy tree
     * @returns PageTreeResponseDto Page hierarchy tree
     * @throws ApiError
     */
    public static contextControllerGetPageTree(): CancelablePromise<Array<PageTreeResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/context/blocks/tree',
        });
    }
    /**
     * Fetch a wiki page by ID
     * @param id Context page identifier
     * @returns PageResponseDto Context page retrieved successfully
     * @throws ApiError
     */
    public static contextControllerGetPage(
        id: string,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/context/blocks/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Update an existing wiki page
     * @param id Context page identifier
     * @param requestBody
     * @returns PageResponseDto Context page updated successfully
     * @throws ApiError
     */
    public static contextControllerUpdatePage(
        id: string,
        requestBody: UpdatePageDto,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/context/blocks/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `No update fields provided`,
            },
        });
    }
    /**
     * Delete a wiki page
     * @param id Context page identifier
     * @returns void
     * @throws ApiError
     */
    public static contextControllerDeletePage(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/context/blocks/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Append content to an existing wiki page
     * @param id Context page identifier
     * @param requestBody
     * @returns PageResponseDto Context page content appended successfully
     * @throws ApiError
     */
    public static contextControllerAppendToPage(
        id: string,
        requestBody: AppendPageDto,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/context/blocks/{id}/append',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Reorder a page within siblings
     * @param id Context page identifier
     * @param requestBody
     * @returns PageResponseDto Page reordered successfully
     * @throws ApiError
     */
    public static contextControllerReorderPage(
        id: string,
        requestBody: ReorderPageDto,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/context/blocks/{id}/reorder',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Move page to different parent
     * @param id Context page identifier
     * @param requestBody
     * @returns PageResponseDto Page moved successfully
     * @throws ApiError
     */
    public static contextControllerMovePage(
        id: string,
        requestBody: MovePageDto,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/context/blocks/{id}/move',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Circular reference detected or parent not found`,
            },
        });
    }
    /**
     * Add a tag to a wiki page
     * @param id Context page identifier
     * @param requestBody
     * @returns PageResponseDto Tag added to page successfully
     * @throws ApiError
     */
    public static contextControllerAddTagToPage(
        id: string,
        requestBody: AddContextTagDto,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/context/blocks/{id}/tags',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * Remove a tag from a wiki page
     * @param id
     * @param tagId
     * @returns PageResponseDto Tag removed from page successfully
     * @throws ApiError
     */
    public static contextControllerRemoveTagFromPage(
        id: string,
        tagId: string,
    ): CancelablePromise<PageResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/context/blocks/{id}/tags/{tagId}',
            path: {
                'id': id,
                'tagId': tagId,
            },
        });
    }
    /**
     * Create a new tag
     * @param requestBody
     * @returns ContextTagResponseDto Tag created successfully
     * @throws ApiError
     */
    public static contextControllerCreateTag(
        requestBody: CreateContextTagDto,
    ): CancelablePromise<ContextTagResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/context/blocks/tags',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * Get all tags
     * @returns ContextTagResponseDto List of all tags
     * @throws ApiError
     */
    public static contextControllerGetAllTags(): CancelablePromise<Array<ContextTagResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/context/blocks/tags/all',
        });
    }
    /**
     * Delete a tag from the system
     * @param tagId
     * @returns void
     * @throws ApiError
     */
    public static contextControllerDeleteTag(
        tagId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/context/blocks/tags/{tagId}',
            path: {
                'tagId': tagId,
            },
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpPut(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpDelete(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpPatch(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpOptions(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'OPTIONS',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpHead(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'HEAD',
            url: '/api/v1/context/blocks/mcp',
        });
    }
}
