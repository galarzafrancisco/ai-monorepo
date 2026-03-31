/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AppendBlockDto } from '../models/AppendBlockDto.js';
import type { BlockListResponseDto } from '../models/BlockListResponseDto.js';
import type { BlockResponseDto } from '../models/BlockResponseDto.js';
import type { BlockSearchResultDto } from '../models/BlockSearchResultDto.js';
import type { BlockTreeResponseDto } from '../models/BlockTreeResponseDto.js';
import type { CreateBlockDto } from '../models/CreateBlockDto.js';
import type { CreateTagDto } from '../models/CreateTagDto.js';
import type { MoveBlockDto } from '../models/MoveBlockDto.js';
import type { ReorderBlockDto } from '../models/ReorderBlockDto.js';
import type { UpdateBlockDto } from '../models/UpdateBlockDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import type { OpenAPIConfig } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ContextService {
    /**
     * Create a new wiki page
     * @param requestBody
     * @returns BlockResponseDto Context page created successfully
     * @throws ApiError
     */
    public static contextControllerCreateBlock(
        requestBody: CreateBlockDto,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockListResponseDto> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/context/blocks',
            query: {
                'tag': tag,
            },
        });
    }
    /**
     * Search blocks by query string
     * @param query Search query string
     * @param limit Maximum number of results to return
     * @param threshold Minimum score threshold (0-1, higher is stricter)
     * @returns BlockSearchResultDto Search results sorted by relevance
     * @throws ApiError
     */
    public static contextControllerSearchBlocks(
        query: string,
        limit: number = 10,
        threshold: number = 0.3,
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<Array<BlockSearchResultDto>> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/context/blocks/search/query',
            query: {
                'query': query,
                'limit': limit,
                'threshold': threshold,
            },
        });
    }
    /**
     * Get page hierarchy tree
     * @returns BlockTreeResponseDto Page hierarchy tree
     * @throws ApiError
     */
    public static contextControllerGetBlockTree(config: OpenAPIConfig = OpenAPI): CancelablePromise<Array<BlockTreeResponseDto>> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<void> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockResponseDto> {
        return __request(config, {
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
        config: OpenAPIConfig = OpenAPI,
    ): CancelablePromise<BlockResponseDto> {
        return __request(config, {
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
    public static contextControllerHandleMcpGet(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'GET',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpPost(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'POST',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpPut(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'PUT',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpDelete(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'DELETE',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpPatch(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'PATCH',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpOptions(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'OPTIONS',
            url: '/api/v1/context/blocks/mcp',
        });
    }
    /**
     * @returns any
     * @throws ApiError
     */
    public static contextControllerHandleMcpHead(config: OpenAPIConfig = OpenAPI): CancelablePromise<any> {
        return __request(config, {
            method: 'HEAD',
            url: '/api/v1/context/blocks/mcp',
        });
    }
}
