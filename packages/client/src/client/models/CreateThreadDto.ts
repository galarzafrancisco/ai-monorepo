/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateThreadDto = {
    /**
     * Title of the thread. If not provided, will be auto-generated.
     */
    title?: string;
    /**
     * Parent task ID - the task that this thread belongs to (optional for headless threads)
     */
    parentTaskId?: string;
    /**
     * Array of tag names to associate with the thread
     */
    tagNames?: Array<string>;
    /**
     * Array of task IDs to attach to this thread
     */
    taskIds?: Array<string>;
    /**
     * Array of context block IDs to reference in this thread
     */
    contextBlockIds?: Array<string>;
    /**
     * Array of actor IDs to add as participants
     */
    participantActorIds?: Array<string>;
};

