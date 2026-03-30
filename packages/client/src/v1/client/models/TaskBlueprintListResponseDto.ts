/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TaskBlueprintResponseDto } from './TaskBlueprintResponseDto.js';
export type TaskBlueprintListResponseDto = {
    /**
     * List of task blueprints
     */
    items: Array<TaskBlueprintResponseDto>;
    /**
     * Total number of task blueprints
     */
    total: number;
    /**
     * Current page number
     */
    page: number;
    /**
     * Number of items per page
     */
    limit: number;
};

