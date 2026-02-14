/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
import type { TagResponseDto } from './TagResponseDto.js';
export type TaskBlueprintResponseDto = {
    /**
     * Unique identifier for the task blueprint
     */
    id: string;
    /**
     * Name of the task blueprint
     */
    name: string;
    /**
     * Detailed description of the task blueprint
     */
    description: string;
    /**
     * ID of the default assignee for tasks created from this blueprint
     */
    assigneeActorId?: Record<string, any> | null;
    /**
     * Actor assigned to tasks created from this blueprint
     */
    assigneeActor?: ActorResponseDto | null;
    /**
     * Tags associated with tasks created from this blueprint
     */
    tags: Array<TagResponseDto>;
    /**
     * Array of task IDs that tasks created from this blueprint should depend on
     */
    dependsOnIds: Array<string>;
    /**
     * Actor who created this task blueprint
     */
    createdByActor: ActorResponseDto;
    /**
     * Row version for optimistic locking
     */
    rowVersion: number;
    /**
     * Blueprint creation timestamp
     */
    createdAt: string;
    /**
     * Blueprint last update timestamp
     */
    updatedAt: string;
};

