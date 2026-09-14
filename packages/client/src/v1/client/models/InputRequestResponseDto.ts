/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
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
     * Actor who asked the question, including deactivated personas
     */
    askedByActor?: ActorResponseDto | null;
    /**
     * Actor assigned to answer, including deactivated personas
     */
    assignedToActor?: ActorResponseDto | null;
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

