/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateTaskBlueprintDto = {
    /**
     * Name of the task blueprint
     */
    name?: string;
    /**
     * Detailed description of the task blueprint
     */
    description?: string;
    /**
     * ID or slug of the default assignee for tasks created from this blueprint
     */
    assigneeActorId?: Record<string, any> | null;
    /**
     * Array of tag names to associate with tasks created from this blueprint
     */
    tagNames?: Array<string>;
    /**
     * Array of task IDs that tasks created from this blueprint should depend on
     */
    dependsOnIds?: Array<string>;
};

