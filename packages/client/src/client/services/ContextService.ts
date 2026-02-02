/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AppendBlockDto } from '../models/AppendBlockDto';
import type { BlockListResponseDto } from '../models/BlockListResponseDto';
import type { BlockResponseDto } from '../models/BlockResponseDto';
import type { BlockTreeResponseDto } from '../models/BlockTreeResponseDto';
import type { CreateBlockDto } from '../models/CreateBlockDto';
import type { CreateTagDto } from '../models/CreateTagDto';
import type { MoveBlockDto } from '../models/MoveBlockDto';
import type { ReorderBlockDto } from '../models/ReorderBlockDto';
import type { UpdateBlockDto } from '../models/UpdateBlockDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ContextService {
    /**
     * Create a new wiki page
     * @param requestBody
     * @returns BlockResponseDto Context page created successfully
     * @throws ApiError
     */
    public static contextControllerCreateBlock(
        requestBody: CreateBlockDto,
    ): CancelablePromise<BlockResponseDto> {
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
     * @param tag Filter blocks by tag name
     * @returns BlockListResponseDto List of wiki pages
     * @throws ApiError
     */
    public static contextControllerListBlocks(
        tag?: string,
    ): CancelablePromise<BlockListResponseDto> {
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
     * @returns BlockTreeResponseDto Page hierarchy tree
     * @throws ApiError
     */
    public static contextControllerGetBlockTree(): CancelablePromise<Array<BlockTreeResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/context/blocks/tree',
        });
    }
    /**
     * Fetch a wiki page by ID
     * @param id Context block identifier
     * @returns BlockResponseDto Context page retrieved successfully
     * @throws ApiError
     */
    public static contextControllerGetBlock(
        id: string,
    ): CancelablePromise<BlockResponseDto> {
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
     * @param id Context block identifier
     * @param requestBody
     * @returns BlockResponseDto Context page updated successfully
     * @throws ApiError
     */
    public static contextControllerUpdateBlock(
        id: string,
        requestBody: UpdateBlockDto,
    ): CancelablePromise<BlockResponseDto> {
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
     * @param id Context block identifier
     * @returns void
     * @throws ApiError
     */
    public static contextControllerDeleteBlock(
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
     * @param id Context block identifier
     * @param requestBody
     * @returns BlockResponseDto Context page content appended successfully
     * @throws ApiError
     */
    public static contextControllerAppendToBlock(
        id: string,
        requestBody: AppendBlockDto,
    ): CancelablePromise<BlockResponseDto> {
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
     * @param id Context block identifier
     * @param requestBody
     * @returns BlockResponseDto Page reordered successfully
     * @throws ApiError
     */
    public static contextControllerReorderBlock(
        id: string,
        requestBody: ReorderBlockDto,
    ): CancelablePromise<BlockResponseDto> {
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
     * @param id Context block identifier
     * @param requestBody
     * @returns BlockResponseDto Page moved successfully
     * @throws ApiError
     */
    public static contextControllerMoveBlock(
        id: string,
        requestBody: MoveBlockDto,
    ): CancelablePromise<BlockResponseDto> {
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
     * @param id Context block identifier
     * @param requestBody
     * @returns BlockResponseDto Tag added to page successfully
     * @throws ApiError
     */
    public static contextControllerAddTagToBlock(
        id: string,
        requestBody: CreateTagDto,
    ): CancelablePromise<BlockResponseDto> {
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
     * @returns BlockResponseDto Tag removed from page successfully
     * @throws ApiError
     */
    public static contextControllerRemoveTagFromBlock(
        id: string,
        tagId: string,
    ): CancelablePromise<BlockResponseDto> {
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
