/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto';
export type AssigneeHistoryResponseDto = {
    /**
     * Unique identifier for the history entry
     */
    id: string;
    /**
     * Task ID this history entry belongs to
     */
    taskId: string;
    /**
     * Actor ID of the assignee
     */
    assigneeActorId: string;
    /**
     * Actor who was assigned
     */
    assigneeActor: ActorResponseDto;
    /**
     * Timestamp when this assignment occurred
     */
    assignedAt: string;
};

