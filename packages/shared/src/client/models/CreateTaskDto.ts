/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateTaskDto = {
    /**
     * Name of the task
     */
    name: string;
    /**
     * Detailed description of the task
     */
    description: string;
    /**
     * Name of the assignee (for AI agents)
     */
    assignee?: string;
    /**
     * Session ID for tracking AI agent work
     */
    sessionId?: string;
    /**
     * Array of tag names to associate with the task
     */
    tagNames?: Array<string>;
    /**
     * Name of the person who created the task
     */
    createdBy: string;
    /**
     * Array of task IDs that this task depends on
     */
    dependsOnIds?: Array<string>;
};

