/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateProjectDto } from '../models/CreateProjectDto';
import type { PatchProjectDto } from '../models/PatchProjectDto';
import type { ProjectResponseDto } from '../models/ProjectResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MetaProjectsService {
    /**
     * Create a new project
     * @param requestBody
     * @returns ProjectResponseDto Project created successfully
     * @throws ApiError
     */
    public static projectsControllerCreateProject(
        requestBody: CreateProjectDto,
    ): CancelablePromise<ProjectResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/meta/projects',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
            },
        });
    }
    /**
     * Get all projects
     * @returns ProjectResponseDto List of all projects
     * @throws ApiError
     */
    public static projectsControllerGetAllProjects(): CancelablePromise<Array<ProjectResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/meta/projects',
        });
    }
    /**
     * Search projects by name and description
     * @param q Search query
     * @param limit Maximum number of results
     * @param threshold Match threshold (0-1)
     * @returns ProjectResponseDto List of matching projects
     * @throws ApiError
     */
    public static projectsControllerSearchProjects(
        q: string,
        limit?: number,
        threshold?: number,
    ): CancelablePromise<Array<ProjectResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/meta/projects/search',
            query: {
                'q': q,
                'limit': limit,
                'threshold': threshold,
            },
        });
    }
    /**
     * Get project by slug
     * @param slug
     * @returns ProjectResponseDto Project found
     * @throws ApiError
     */
    public static projectsControllerGetProjectBySlug(
        slug: string,
    ): CancelablePromise<ProjectResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/meta/projects/by-slug/{slug}',
            path: {
                'slug': slug,
            },
            errors: {
                404: `Project not found`,
            },
        });
    }
    /**
     * Get project by ID
     * @param projectId
     * @returns ProjectResponseDto Project found
     * @throws ApiError
     */
    public static projectsControllerGetProject(
        projectId: string,
    ): CancelablePromise<ProjectResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/meta/projects/{projectId}',
            path: {
                'projectId': projectId,
            },
            errors: {
                404: `Project not found`,
            },
        });
    }
    /**
     * Update project (partial update)
     * @param projectId
     * @param requestBody
     * @returns ProjectResponseDto Project updated successfully
     * @throws ApiError
     */
    public static projectsControllerUpdateProject(
        projectId: string,
        requestBody: PatchProjectDto,
    ): CancelablePromise<ProjectResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/meta/projects/{projectId}',
            path: {
                'projectId': projectId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid input data`,
                404: `Project not found`,
            },
        });
    }
    /**
     * Delete a project
     * @param projectId
     * @returns void
     * @throws ApiError
     */
    public static projectsControllerDeleteProject(
        projectId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/meta/projects/{projectId}',
            path: {
                'projectId': projectId,
            },
            errors: {
                404: `Project not found`,
            },
        });
    }
}
