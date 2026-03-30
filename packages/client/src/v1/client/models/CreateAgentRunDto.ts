/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateAgentRunDto = {
    /**
     * UUID of the parent task being executed
     */
    parentTaskId: string;
    /**
     * UUID of the associated TaskExecution (for new execution-centric paths)
     */
    taskExecutionId?: string | null;
};

