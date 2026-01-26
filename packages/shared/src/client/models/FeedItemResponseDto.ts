/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto';
export type FeedItemResponseDto = {
    /**
     * Unique identifier for the feed item
     */
    id: string;
    /**
     * Type of event that occurred
     */
    eventType: FeedItemResponseDto.eventType;
    /**
     * ID of the task this event is related to
     */
    taskId: string;
    /**
     * Name of the task this event is related to
     */
    taskName: string;
    /**
     * Actor who triggered this event
     */
    actor: ActorResponseDto;
    /**
     * Additional metadata about the event
     */
    metadata?: Record<string, any>;
    /**
     * When this event occurred
     */
    createdAt: string;
};
export namespace FeedItemResponseDto {
    /**
     * Type of event that occurred
     */
    export enum eventType {
        TASK_CREATED = 'TASK_CREATED',
        TASK_UPDATED = 'TASK_UPDATED',
        TASK_ASSIGNED = 'TASK_ASSIGNED',
        TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
        TASK_DELETED = 'TASK_DELETED',
        COMMENT_ADDED = 'COMMENT_ADDED',
    }
}

