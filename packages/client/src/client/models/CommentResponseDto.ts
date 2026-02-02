/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
export type CommentResponseDto = {
    /**
     * Unique identifier for the comment
     */
    id: string;
    /**
     * ID of the task this comment belongs to
     */
    taskId: string;
    /**
     * Display name of the commenter (for backward compatibility)
     */
    commenterName: string;
    /**
     * Actor who created this comment
     */
    commenterActor?: ActorResponseDto | null;
    /**
     * Content of the comment
     */
    content: string;
    /**
     * Comment creation timestamp
     */
    createdAt: string;
};

