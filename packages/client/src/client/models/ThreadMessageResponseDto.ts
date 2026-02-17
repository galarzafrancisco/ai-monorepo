/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
export type ThreadMessageResponseDto = {
    /**
     * Message ID
     */
    id: string;
    /**
     * Thread ID this message belongs to
     */
    threadId: string;
    /**
     * Content of the message
     */
    content: string;
    /**
     * Actor ID who created the message
     */
    createdByActorId?: string | null;
    /**
     * Actor who created the message
     */
    createdByActor?: ActorResponseDto | null;
    /**
     * When the message was created
     */
    createdAt: string;
    /**
     * When the message was last updated
     */
    updatedAt: string;
};

