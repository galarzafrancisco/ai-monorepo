/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type InputRequestResponseDto = {
    /**
     * Unique identifier for the input request
     */
    id: string;
    /**
     * ID of the task this input request belongs to
     */
    taskId: string;
    /**
     * ID of the actor who asked the question
     */
    askedByActorId: string;
    /**
     * ID of the actor assigned to answer the question
     */
    assignedToActorId: string;
    /**
     * The question being asked
     */
    question: string;
    /**
     * The answer to the question
     */
    answer?: Record<string, any> | null;
    /**
     * Timestamp when the question was resolved
     */
    resolvedAt?: Record<string, any> | null;
    /**
     * Input request creation timestamp
     */
    createdAt: string;
    /**
     * Input request last update timestamp
     */
    updatedAt: string;
};

