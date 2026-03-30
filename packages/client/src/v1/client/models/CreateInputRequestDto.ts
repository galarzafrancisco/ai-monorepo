/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateInputRequestDto = {
    /**
     * ID of the actor assigned to answer the question. Defaults to task creator if not provided.
     */
    assignedToActorId?: string;
    /**
     * The question being asked
     */
    question: string;
};

