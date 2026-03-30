/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateTaskDto = {
    /**
     * Name of the task
     */
    name?: string;
    /**
     * Detailed description of the task
     */
    description?: string;
    /**
     * ID of the assignee
     */
    assigneeActorId?: string;
    /**
     * Session ID for tracking AI agent work
     */
    sessionId?: string;
    /**
     * Array of tag names to associate with the task
     */
    tagNames?: Array<string>;
    /**
     * Array of task IDs that this task depends on
     */
    dependsOnIds?: Array<string>;
};

